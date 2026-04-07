import { getPool } from "../../db-postgres";
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

    const pool = getPool();

    const existing = await pool.query(
      'SELECT id FROM scim_users WHERE username = $1',
      [userData.userName],
    );
    if (existing.rows.length > 0) {
      throw new Error(`User with userName '${userData.userName}' already exists.`);
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const newUser: ScimUser = {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
      id,
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

    await pool.query(
      'INSERT INTO scim_users (id, username, active, resource, "tenantId") VALUES ($1, $2, $3, $4, $5)',
      [newUser.id, newUser.userName, newUser.active, newUser, userId],
    );

    return newUser;
  }

  public async getUsers(
    startIndex: number,
    count: number,
    userId: string,
    filter?: string | null
  ): Promise<{ users: ScimUser[]; total: number }> {
    const pool   = getPool();
    const offset = startIndex - 1;

    if (filter) {
      const filterRegex = /([\w\.]+)\s+eq\s+"([^"]+)"/i;
      const match = filter.match(filterRegex);

      if (match) {
        const scimAttribute = match[1];
        const value         = match[2];
        const username      = value.split("@")[0];

        switch (scimAttribute.toLowerCase()) {
          case "username": {
            const result = await pool.query(
              `SELECT resource, COUNT(*) OVER()::int AS total_count
               FROM scim_users
               WHERE "tenantId" = $1 AND username = $2
               ORDER BY created_at
               OFFSET $3 LIMIT $4`,
              [userId, username, offset, count],
            );
            const total = result.rows.length > 0 ? result.rows[0].total_count : 0;
            const users = result.rows.map((r: any) => normalizeUser(r.resource as ScimUser));
            return { users, total };
          }
          default:
            throw new Error(`Invalid or unsupported filter attribute: ${scimAttribute}`);
        }
      } else {
        throw new Error(`Invalid or unsupported filter syntax: "${filter}"`);
      }
    }

    const result = await pool.query(
      `SELECT resource, COUNT(*) OVER()::int AS total_count
       FROM scim_users
       WHERE "tenantId" = $1
       ORDER BY created_at
       OFFSET $2 LIMIT $3`,
      [userId, offset, count],
    );

    const total = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const users = result.rows.map((r: any) => normalizeUser(r.resource as ScimUser));
    return { users, total };
  }

  public async getUserById(id: string): Promise<ScimUser | null> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT resource FROM scim_users WHERE id = $1',
        [id],
      );
      if (result.rows.length === 0) return null;
      return normalizeUser(result.rows[0].resource as ScimUser);
    } catch (err: any) {
      if (err.code === "22P02") return null;
      throw err;
    }
  }

  public async updateUser(
    id: string,
    userData: Partial<ScimUser>
  ): Promise<ScimUser | null> {
    const originalUser = await this.getUserById(id);
    if (!originalUser) return null;

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

    const pool = getPool();
    await pool.query(
      `UPDATE scim_users
       SET username = $1, active = $2, resource = $3, last_modified_at = $4
       WHERE id = $5`,
      [updatedUser.userName, updatedUser.active, updatedUser, now, id],
    );

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

    const pool = getPool();
    await pool.query(
      `UPDATE scim_users SET active = $1, resource = $2, last_modified_at = $3 WHERE id = $4`,
      [user.active, user, now, id],
    );

    return user;
  }

  public async deleteUser(id: string): Promise<boolean> {
    const pool   = getPool();
    const result = await pool.query(
      'DELETE FROM scim_users WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  public async deleteAllUsers(id: string): Promise<boolean> {
    const pool = getPool();
    await pool.query('DELETE FROM scim_users WHERE id::text != $1', [id]);
    return true;
  }
}
