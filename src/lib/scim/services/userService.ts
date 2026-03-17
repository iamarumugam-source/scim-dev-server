import { supabase } from "../db";
import { ScimUser, ScimEntitlementAttribute, ScimRoleAttribute } from "../models/scimSchemas";
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
      active: newUser.active,
      resource: newUser,
      tenantId: userId,
    });

    if (error) {
      throw new Error(`Supabase error creating user: ${error.message}`);
    }

    return newUser;
  }

  public async getUsers(
    startIndex: number,
    count: number,
    userId: string,
    filter?: string | null
  ): Promise<{ users: ScimUser[]; total: number }> {
    let query = supabase
      .from(TABLE_NAME)
      .select("resource", { count: "exact" })
      .eq("tenantId", userId);

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
            // replace entire attribute map (e.g. { active: false })
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
          // path like: entitlements[value eq "id123"]  or just "entitlements"
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
