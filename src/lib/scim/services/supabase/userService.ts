import { supabase } from "../../db";
import { ScimUser, ScimEntitlementAttribute, ScimRoleAttribute } from "../../models/scimSchemas";
import { v4 as uuidv4 } from "uuid";

interface PatchOperation {
  op: "add" | "replace" | "remove";
  path?: string;
  value?: any;
}

interface ScimPatchOp {
  schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"];
  Operations: PatchOperation[];
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const TABLE_NAME = "scim_users";

/** Replace the origin of a stored URL with the current public BASE_URL. */
function rewriteOrigin(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    const b = new URL(BASE_URL);
    u.protocol = b.protocol;
    u.hostname = b.hostname;
    u.port     = b.port;
    return u.toString();
  } catch { return url; }
}

function normalizeUser(user: ScimUser): ScimUser {
  return {
    ...user,
    meta:   user.meta   ? { ...user.meta, location: rewriteOrigin(user.meta.location ?? "") } : user.meta,
    groups: user.groups?.map((g: any) => ({ ...g, $ref: rewriteOrigin(g.$ref) })),
  };
}

export class UserService {
  public async createUser(
    userData: Partial<ScimUser>,
    userId: string
  ): Promise<ScimUser> {
    if (!userData.userName) {
      throw new Error("userName is a required field.");
    }

    const { data: existingUser } = await supabase
      .from(TABLE_NAME)
      .select("id")
      .eq("username", userData.userName)
      .single();

    if (existingUser) {
      throw new Error(
        `User with userName '${userData.userName}' already exists.`
      );
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const newUser: ScimUser = {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id: id,
      userName: userData.userName,
      name: userData.name || {},
      active: userData.active ?? true,
      emails: userData.emails || [],
      ...userData,
      meta: {
        resourceType: "User",
        created: now,
        lastModified: now,
        location: `${BASE_URL}/api/${userId}/scim/v2/Users/${id}`,
        version: `W/"${Date.now()}"`,
      },
    };

    const { error } = await supabase.from(TABLE_NAME).insert({
      id: newUser.id,
      username: newUser.userName,
      // Mirrored into its own column so an OIDC `sub` can be looked up by index.
      // It also lives inside `resource`, which stays the SCIM source of truth.
      external_id: newUser.externalId ?? null,
      active: newUser.active,
      resource: newUser,
      tenantId: userId,
    });

    if (error) {
      throw new Error(`Supabase error creating user: ${error.message}`);
    }

    return newUser;
  }

  /**
   * Resolve a user by the IdP's own identifier. Used by the downstream OIDC login
   * test to match an ID token `sub` to a provisioned record — a stronger link than
   * matching on username, which can be mapped differently by the OIDC app and the
   * SCIM app in the same Okta org.
   */
  public async getUserByExternalId(
    tenantId: string,
    externalId: string
  ): Promise<ScimUser | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("resource")
      .eq("tenantId", tenantId)
      .eq("external_id", externalId)
      .maybeSingle();

    if (error) throw new Error(`Supabase error fetching user by externalId: ${error.message}`);
    return data ? normalizeUser(data.resource as ScimUser) : null;
  }

  /**
   * `filter` is the SCIM filter and stays spec-compliant — Okta depends on
   * `userName eq "..."` returning an exact match (and 404 on no match, which is
   * what makes create-on-assign work). It must not become fuzzy.
   *
   * `search` is a separate, non-SCIM parameter for the admin UI: a substring
   * match across username, display name, name.formatted and email. Adding it
   * alongside rather than loosening `filter` keeps the two concerns apart.
   */
  public async getUsers(
    startIndex: number,
    count: number,
    userId: string,
    filter?: string | null,
    search?: string | null
  ): Promise<{ users: ScimUser[]; total: number }> {
    let query = supabase
      .from(TABLE_NAME)
      .select("resource", { count: "exact" })
      .eq("tenantId", userId);

    if (search && search.trim()) {
      // PostgREST's or() takes a comma-separated grammar, so commas, parens and
      // its own wildcard have to go or the expression breaks. ilike uses * as
      // the wildcard here, not %.
      const q = search.trim().replace(/[,()*%\\]/g, "");
      if (q) {
        query = query.or(
          [
            `username.ilike.*${q}*`,
            `resource->>displayName.ilike.*${q}*`,
            `resource->name->>formatted.ilike.*${q}*`,
            // emails is an array of objects; ->> serialises it, so this matches
            // any address in it without needing a join.
            `resource->>emails.ilike.*${q}*`,
          ].join(","),
        );
      }
    }

    if (filter) {
      const filterRegex = /([\w\.]+)\s+eq\s+"([^"]+)"/i;
      const match = filter.match(filterRegex);

      if (match) {
        const scimAttribute = match[1];
        const value = match[2];
        const username = value.split("@")[0];
        switch (scimAttribute.toLowerCase()) {
          case "username":
            query = query.eq("username", username);
            break;
          default:
            throw new Error(
              `Invalid or unsupported filter attribute: ${scimAttribute}`
            );
        }
      } else {
        throw new Error(`Invalid or unsupported filter syntax: "${filter}"`);
      }
    }

    const from = startIndex - 1;
    const to = from + count - 1;
    query = query.range(from, to);

    const { data, error, count: total } = await query;

    if (error) {
      throw new Error(`Supabase error fetching users: ${error.message}`);
    }

    const users = data.map((row: any) => normalizeUser(row.resource as ScimUser));

    return { users, total: total || 0 };
  }

  public async getUserById(id: string): Promise<ScimUser | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("resource")
      .eq("id", id)
      .single();

    console.log(id);

    if (error) {
      if (error.code === "PGRST116" || error.code == "22P02") return null;
      throw new Error(`Supabase error getting user: ${error.message}`);
    }

    return data ? normalizeUser(data.resource as ScimUser) : null;
  }

  public async updateUser(
    id: string,
    userData: Partial<ScimUser>
  ): Promise<ScimUser | null> {
    const originalUser = await this.getUserById(id);

    if (!originalUser) {
      return null;
    }

    const now = new Date().toISOString();
    const updatedUser: ScimUser = {
      ...originalUser,
      ...userData,
      id: originalUser.id,
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      meta: {
        ...originalUser.meta,
        lastModified: now,
        version: `W/"${Date.now()}"`,
      },
    };

    const { error } = await supabase
      .from(TABLE_NAME)
      .update({
        username: updatedUser.userName,
        external_id: updatedUser.externalId ?? null,
        active: updatedUser.active,
        resource: updatedUser,
        last_modified_at: now,
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase error updating user: ${error.message}`);
    }

    return updatedUser;
  }

  public async patchUser(id: string, patchData: ScimPatchOp): Promise<ScimUser | null> {
    const original = await this.getUserById(id);
    if (!original) return null;

    const user: ScimUser = JSON.parse(JSON.stringify(original));

    for (const op of patchData.Operations) {
      const opLower = op.op.toLowerCase();
      const path    = op.path ?? "";

      switch (opLower) {
        case "replace": {
          if (!path && typeof op.value === "object" && op.value !== null) {
            Object.assign(user, op.value);
          } else if (path === "active") {
            user.active = Boolean(op.value);
          } else if (path === "displayName") {
            user.displayName = op.value;
          } else if (path === "entitlements") {
            user.entitlements = Array.isArray(op.value) ? op.value as ScimEntitlementAttribute[] : [];
          } else if (path === "roles") {
            user.roles = Array.isArray(op.value) ? op.value as ScimRoleAttribute[] : [];
          }
          break;
        }

        case "add": {
          if (path === "entitlements" || path === "roles") {
            const incoming = (Array.isArray(op.value) ? op.value : [op.value]) as any[];
            if (path === "entitlements") {
              const existing = new Set((user.entitlements ?? []).map((e) => e.value));
              const toAdd = incoming.filter((e) => !existing.has(e.value));
              user.entitlements = [...(user.entitlements ?? []), ...toAdd];
            } else {
              const existing = new Set((user.roles ?? []).map((r) => r.value));
              const toAdd = incoming.filter((r) => !existing.has(r.value));
              user.roles = [...(user.roles ?? []), ...toAdd];
            }
          } else if (!path && typeof op.value === "object" && op.value !== null) {
            Object.assign(user, op.value);
          }
          break;
        }

        case "remove": {
          const entMatch = path.match(/^entitlements(?:\[value eq "(.+?)"\])?$/);
          const roleMatch = path.match(/^roles(?:\[value eq "(.+?)"\])?$/);

          if (entMatch) {
            const targetId = entMatch[1];
            user.entitlements = targetId
              ? (user.entitlements ?? []).filter((e) => e.value !== targetId)
              : [];
          } else if (roleMatch) {
            const targetId = roleMatch[1];
            user.roles = targetId
              ? (user.roles ?? []).filter((r) => r.value !== targetId)
              : [];
          }
          break;
        }
      }
    }

    const now = new Date().toISOString();
    user.meta = { ...user.meta, lastModified: now, version: `W/"${Date.now()}"` };

    const { error } = await supabase
      .from(TABLE_NAME)
      .update({ active: user.active, resource: user, last_modified_at: now })
      .eq("id", id);

    if (error) throw new Error(`Supabase error patching user: ${error.message}`);
    return user;
  }

  public async deleteUser(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase error deleting user: ${error.message}`);
    }

    return count !== null && count > 0;
  }

  public async deleteAllUsers(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .delete()
      .neq("id", id);

    if (error) {
      throw new Error(`Supabase error deleting group: ${error.message}`);
    }
    return true;
  }
}
