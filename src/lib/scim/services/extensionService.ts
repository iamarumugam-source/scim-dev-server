import { faker } from "@faker-js/faker";
import { supabase } from "../db";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ExtensionField {
  id:           string;
  name:         string;
  type:         "string" | "integer" | "boolean" | "dateTime" | "reference" | "complex";
  multiValued?: boolean;
  source:       "user_prop" | "random" | "static" | "raw_json";
  userProp?:    string;   // dot-path into the SCIM user (e.g. "name.formatted")
  generator?:   string;   // faker method path  (e.g. "person.jobTitle")
  staticValue?: unknown;  // literal value (primitive)
  rawJson?:     string;   // JSON string for complex objects / arrays
}

export interface SchemaExtension {
  id:        string;
  tenantId:  string;
  schemaUrn: string;
  enabled:   boolean;
  fields:    ExtensionField[];
  createdAt: string;
  updatedAt: string;
}

// ─── In-memory cache (30 s TTL) ────────────────────────────────────────────────

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, { data: SchemaExtension[]; expires: number }>();

function invalidate(tenantId: string) {
  cache.delete(tenantId);
}

// ─── Value resolvers ───────────────────────────────────────────────────────────

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  if (!path) return undefined;
  return path.split(".").reduce((cur: unknown, key: string) => {
    if (cur == null) return undefined;
    if (Array.isArray(cur)) {
      const idx = parseInt(key, 10);
      return isNaN(idx) ? undefined : cur[idx];
    }
    return (cur as Record<string, unknown>)[key];
  }, obj as unknown);
}

function callFaker(generatorPath: string): unknown {
  if (!generatorPath) return null;
  const parts = generatorPath.split(".");
  let obj: unknown = faker;
  for (const part of parts) {
    if (obj == null || typeof obj !== "object") return null;
    obj = (obj as Record<string, unknown>)[part];
  }
  try {
    return typeof obj === "function" ? (obj as () => unknown)() : null;
  } catch {
    return null;
  }
}

// ─── Template interpolation ────────────────────────────────────────────────────
//
// String values inside a raw_json template may contain {{...}} expressions:
//   {{user.name.formatted}}   → reads that dot-path from the SCIM user object
//   {{faker.person.jobTitle}} → calls the corresponding faker method
//
// Non-string values (numbers, booleans, null, nested objects/arrays) are left
// as-is. Objects and arrays are walked recursively so deeply-nested templates
// are resolved correctly.

const EXPR_RE = /^\{\{(.+?)\}\}$/;

function resolveExpr(expr: string, user: Record<string, unknown>): unknown {
  const e = expr.trim();
  if (e.startsWith("user."))  return getNestedValue(user, e.slice(5));
  if (e.startsWith("faker.")) return callFaker(e.slice(6));
  // bare path → try as user property
  return getNestedValue(user, e);
}

function interpolate(value: unknown, user: Record<string, unknown>): unknown {
  if (typeof value === "string") {
    const m = value.match(EXPR_RE);
    return m ? resolveExpr(m[1], user) : value;
  }
  if (Array.isArray(value)) return value.map((v) => interpolate(v, user));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, interpolate(v, user)]),
    );
  }
  return value;
}

function resolveField(field: ExtensionField, user: Record<string, unknown>): unknown {
  switch (field.source) {
    case "user_prop":  return getNestedValue(user, field.userProp ?? "");
    case "random":     return callFaker(field.generator ?? "");
    case "static":     return field.staticValue ?? null;
    case "raw_json": {
      if (!field.rawJson?.trim()) return null;
      try { return interpolate(JSON.parse(field.rawJson), user); } catch { return null; }
    }
    default: return null;
  }
}

// ─── Service methods ───────────────────────────────────────────────────────────

export class ExtensionService {
  private async fetchFromDb(tenantId: string): Promise<SchemaExtension[]> {
    const { data, error } = await supabase
      .from("scim_schema_extensions")
      .select("*")
      .eq("tenantId", tenantId)
      .order("created_at", { ascending: true });

    if (error) {
      console.error("[extensionService] fetch error:", error.message);
      return [];
    }

    return (data ?? []).map((row) => ({
      id:        row.id,
      tenantId:  row.tenantId,
      schemaUrn: row.schema_urn,
      enabled:   row.enabled,
      fields:    (row.fields as ExtensionField[]) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    }));
  }

  async getExtensions(tenantId: string): Promise<SchemaExtension[]> {
    const hit = cache.get(tenantId);
    if (hit && hit.expires > Date.now()) return hit.data;
    const data = await this.fetchFromDb(tenantId);
    cache.set(tenantId, { data, expires: Date.now() + CACHE_TTL_MS });
    return data;
  }

  async getExtensionById(id: string): Promise<SchemaExtension | null> {
    const { data, error } = await supabase
      .from("scim_schema_extensions")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !data) return null;
    return {
      id:        data.id,
      tenantId:  data.tenantId,
      schemaUrn: data.schema_urn,
      enabled:   data.enabled,
      fields:    (data.fields as ExtensionField[]) ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async createExtension(
    tenantId: string,
    schemaUrn: string,
    fields: ExtensionField[] = [],
    enabled = true,
  ): Promise<SchemaExtension> {
    const { data, error } = await supabase
      .from("scim_schema_extensions")
      .insert({ tenantId, schema_urn: schemaUrn, fields, enabled })
      .select()
      .single();

    if (error) throw new Error(`Failed to create extension: ${error.message}`);
    invalidate(tenantId);
    return {
      id:        data.id,
      tenantId:  data.tenantId,
      schemaUrn: data.schema_urn,
      enabled:   data.enabled,
      fields:    (data.fields as ExtensionField[]) ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async updateExtension(
    id: string,
    tenantId: string,
    updates: Partial<{ schemaUrn: string; fields: ExtensionField[]; enabled: boolean }>,
  ): Promise<SchemaExtension | null> {
    const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (updates.schemaUrn !== undefined) payload["schema_urn"] = updates.schemaUrn;
    if (updates.fields    !== undefined) payload["fields"]     = updates.fields;
    if (updates.enabled   !== undefined) payload["enabled"]    = updates.enabled;

    const { data, error } = await supabase
      .from("scim_schema_extensions")
      .update(payload)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) return null;
    invalidate(tenantId);
    return {
      id:        data.id,
      tenantId:  data.tenantId,
      schemaUrn: data.schema_urn,
      enabled:   data.enabled,
      fields:    (data.fields as ExtensionField[]) ?? [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };
  }

  async deleteExtension(id: string, tenantId: string): Promise<boolean> {
    const { error, count } = await supabase
      .from("scim_schema_extensions")
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw new Error(`Failed to delete extension: ${error.message}`);
    invalidate(tenantId);
    return (count ?? 0) > 0;
  }

  // ── Interceptor ────────────────────────────────────────────────────────────
  //
  // Applies all enabled extensions for the tenant to a SCIM user object.
  // Values are computed on-the-fly — nothing is persisted.

  async applyExtensions(
    user: Record<string, unknown>,
    tenantId: string,
  ): Promise<Record<string, unknown>> {
    const extensions = await this.getExtensions(tenantId);
    const enabled    = extensions.filter((e) => e.enabled);
    if (enabled.length === 0) return user;

    const result  = { ...user };
    const schemas = [...((user.schemas as string[]) ?? [])];

    for (const ext of enabled) {
      if (ext.fields.length === 0) continue;

      const extData: Record<string, unknown> = {};
      for (const field of ext.fields) {
        const value = resolveField(field, user);

        if (!field.name.trim()) {
          // Empty-named field: if the value is a plain object, spread its keys
          // directly into the extension.  This lets you define the whole
          // extension structure as a single raw_json template.
          if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            Object.assign(extData, value);
          }
          // Non-object values with no name are silently skipped.
          continue;
        }

        extData[field.name] = value;
      }

      result[ext.schemaUrn] = extData;
      if (!schemas.includes(ext.schemaUrn)) schemas.push(ext.schemaUrn);
    }

    result.schemas = schemas;
    return result;
  }
}

export const extensionService = new ExtensionService();
