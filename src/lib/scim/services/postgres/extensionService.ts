import { faker } from "@faker-js/faker";
import { getPool } from "../../db-postgres";

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ExtensionField {
  id:           string;
  name:         string;
  type:         "string" | "integer" | "boolean" | "dateTime" | "reference" | "complex";
  multiValued?: boolean;
  source:       "user_prop" | "random" | "static" | "raw_json";
  userProp?:    string;
  generator?:   string;
  staticValue?: unknown;
  rawJson?:     string;
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

const EXPR_RE = /^\{\{(.+?)\}\}$/;

function resolveExpr(expr: string, user: Record<string, unknown>): unknown {
  const e = expr.trim();
  if (e.startsWith("user."))  return getNestedValue(user, e.slice(5));
  if (e.startsWith("faker.")) return callFaker(e.slice(6));
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
  private mapRow(row: any): SchemaExtension {
    return {
      id:        row.id,
      tenantId:  row.tenantId,
      schemaUrn: row.schema_urn,
      enabled:   row.enabled,
      fields:    (row.fields as ExtensionField[]) ?? [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private async fetchFromDb(tenantId: string): Promise<SchemaExtension[]> {
    const pool = getPool();
    try {
      const result = await pool.query(
        `SELECT id, "tenantId", schema_urn, enabled, fields, created_at, updated_at
         FROM scim_schema_extensions
         WHERE "tenantId" = $1
         ORDER BY created_at ASC`,
        [tenantId],
      );
      return result.rows.map((r) => this.mapRow(r));
    } catch (err: any) {
      console.error("[extensionService] fetch error:", err.message);
      return [];
    }
  }

  async getExtensions(tenantId: string): Promise<SchemaExtension[]> {
    const hit = cache.get(tenantId);
    if (hit && hit.expires > Date.now()) return hit.data;
    const data = await this.fetchFromDb(tenantId);
    cache.set(tenantId, { data, expires: Date.now() + CACHE_TTL_MS });
    return data;
  }

  async getExtensionById(id: string): Promise<SchemaExtension | null> {
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, "tenantId", schema_urn, enabled, fields, created_at, updated_at
       FROM scim_schema_extensions
       WHERE id = $1`,
      [id],
    );
    if (result.rows.length === 0) return null;
    return this.mapRow(result.rows[0]);
  }

  async createExtension(
    tenantId: string,
    schemaUrn: string,
    fields: ExtensionField[] = [],
    enabled = true,
  ): Promise<SchemaExtension> {
    const pool   = getPool();
    const result = await pool.query(
      `INSERT INTO scim_schema_extensions ("tenantId", schema_urn, fields, enabled)
       VALUES ($1, $2, $3, $4)
       RETURNING id, "tenantId", schema_urn, enabled, fields, created_at, updated_at`,
      [tenantId, schemaUrn, JSON.stringify(fields), enabled],
    );
    invalidate(tenantId);
    return this.mapRow(result.rows[0]);
  }

  async updateExtension(
    id: string,
    tenantId: string,
    updates: Partial<{ schemaUrn: string; fields: ExtensionField[]; enabled: boolean }>,
  ): Promise<SchemaExtension | null> {
    const setClauses: string[] = ["updated_at = NOW()"];
    const params: unknown[]    = [];

    if (updates.schemaUrn !== undefined) {
      params.push(updates.schemaUrn);
      setClauses.push(`schema_urn = $${params.length}`);
    }
    if (updates.fields !== undefined) {
      params.push(JSON.stringify(updates.fields));
      setClauses.push(`fields = $${params.length}`);
    }
    if (updates.enabled !== undefined) {
      params.push(updates.enabled);
      setClauses.push(`enabled = $${params.length}`);
    }

    params.push(id);
    const pool   = getPool();
    const result = await pool.query(
      `UPDATE scim_schema_extensions
       SET ${setClauses.join(", ")}
       WHERE id = $${params.length}
       RETURNING id, "tenantId", schema_urn, enabled, fields, created_at, updated_at`,
      params,
    );

    if (result.rows.length === 0) return null;
    invalidate(tenantId);
    return this.mapRow(result.rows[0]);
  }

  async deleteExtension(id: string, tenantId: string): Promise<boolean> {
    const pool   = getPool();
    const result = await pool.query(
      'DELETE FROM scim_schema_extensions WHERE id = $1 RETURNING id',
      [id],
    );
    if ((result.rowCount ?? 0) > 0) invalidate(tenantId);
    return result.rowCount !== null && result.rowCount > 0;
  }

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
          if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            Object.assign(extData, value);
          }
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
