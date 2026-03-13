import { supabase } from "../db";
import { ScimRole } from "../models/scimSchemas";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const TABLE    = "scim_roles";

export class RoleService {
  public async createRole(data: Partial<ScimRole>, userId: string): Promise<ScimRole> {
    if (!data.displayName?.trim()) throw new Error("displayName is a required field.");

    const { data: existing } = await supabase
      .from(TABLE)
      .select("id")
      .eq("tenantId", userId)
      .eq("display_name", data.displayName.trim())
      .single();

    if (existing) throw new Error(`Role with name '${data.displayName}' already exists.`);

    const id  = uuidv4();
    const now = new Date().toISOString();

    const role: ScimRole = {
      schemas:     ["urn:okta:scim:schemas:core:1.0:Role"],
      id,
      displayName: data.displayName.trim(),
      description: data.description?.trim(),
      meta: {
        resourceType: "Entitlement", // Okta uses "Entitlement" for the meta.resourceType on roles too
        created:      now,
        lastModified: now,
        location:     `${BASE_URL}/api/${userId}/scim/v2/Roles/${id}`,
        version:      `W/"${Date.now()}"`,
      },
    };

    const { error } = await supabase.from(TABLE).insert({
      id,
      display_name: role.displayName,
      resource:     role,
      tenantId:     userId,
    });

    if (error) throw new Error(`Supabase error creating role: ${error.message}`);
    return role;
  }

  public async getRoles(
    startIndex: number = 1,
    count: number = 10,
    userId: string,
  ): Promise<{ roles: ScimRole[]; total: number }> {
    const { data, error, count: total } = await supabase
      .from(TABLE)
      .select("resource", { count: "exact" })
      .eq("tenantId", userId)
      .range(startIndex - 1, startIndex - 1 + count - 1);

    if (error) throw new Error(`Supabase error getting roles: ${error.message}`);
    return { roles: (data ?? []).map((r) => r.resource as ScimRole), total: total ?? 0 };
  }

  public async getRoleById(id: string): Promise<ScimRole | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("resource")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return undefined;
      throw new Error(`Supabase error getting role: ${error.message}`);
    }
    return data ? (data.resource as ScimRole) : undefined;
  }

  public async updateRole(id: string, data: Partial<ScimRole>): Promise<ScimRole | null> {
    const original = await this.getRoleById(id);
    if (!original) return null;

    const now = new Date().toISOString();
    const updated: ScimRole = {
      ...original,
      displayName: data.displayName?.trim() ?? original.displayName,
      description: data.description !== undefined ? data.description?.trim() : original.description,
      meta: { ...original.meta, lastModified: now, version: `W/"${Date.now()}"` },
    };

    const { error } = await supabase
      .from(TABLE)
      .update({ display_name: updated.displayName, resource: updated, last_modified_at: now })
      .eq("id", id);

    if (error) throw new Error(`Supabase error updating role: ${error.message}`);
    return updated;
  }

  public async deleteRole(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE)
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw new Error(`Supabase error deleting role: ${error.message}`);
    return (count ?? 0) > 0;
  }

  public async deleteAllRoles(userId: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("tenantId", userId);
    if (error) throw new Error(`Supabase error deleting roles: ${error.message}`);
  }
}
