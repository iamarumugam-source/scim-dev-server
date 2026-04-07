import { supabase } from "../../db";
import { ScimUser, ScimGroup, ScimEntitlement, ScimRole } from "../../models/scimSchemas";

export class GenerateService {
  async deleteExistingData(userId: string): Promise<void> {
    const { error: er } = await supabase.from("scim_roles").delete().eq("tenantId", userId);
    if (er) throw new Error(`Failed to delete roles: ${er.message}`);

    const { error: ee } = await supabase.from("scim_entitlements").delete().eq("tenantId", userId);
    if (ee) throw new Error(`Failed to delete entitlements: ${ee.message}`);

    const { error: eg } = await supabase.from("scim_groups").delete().eq("tenantId", userId);
    if (eg) throw new Error(`Failed to delete groups: ${eg.message}`);

    const { error: eu } = await supabase.from("scim_users").delete().eq("tenantId", userId);
    if (eu) throw new Error(`Failed to delete users: ${eu.message}`);
  }

  async getExistingUsers(userId: string): Promise<ScimUser[]> {
    const { data, error } = await supabase
      .from("scim_users")
      .select("resource")
      .eq("tenantId", userId);

    if (error) throw new Error(`Failed to fetch existing users: ${error.message}`);
    return ((data ?? []).map((u) => u.resource) as ScimUser[]).map((u) => {
      if (!u.groups) u.groups = [];
      return u;
    });
  }

  async getExistingGroupNames(userId: string): Promise<string[]> {
    const { data } = await supabase
      .from("scim_groups")
      .select("display_name")
      .eq("tenantId", userId);

    return (data ?? []).map((r: any) => r.display_name as string);
  }

  async persistGenerated(
    userId: string,
    users: ScimUser[],
    existingUsers: ScimUser[],
    groups: ScimGroup[],
    entitlements: ScimEntitlement[],
    roles: ScimRole[],
  ): Promise<void> {
    if (users.length > 0) {
      const { error } = await supabase.from("scim_users").insert(
        users.map((u) => ({ id: u.id, username: u.userName, active: u.active, resource: u, tenantId: userId }))
      );
      if (error) throw new Error(`User insertion failed: ${error.message}`);
    }

    if (existingUsers.length > 0) {
      const { error } = await supabase.from("scim_users").upsert(
        existingUsers.map((u) => ({ id: u.id, username: u.userName, active: u.active, resource: u, tenantId: userId })),
        { onConflict: "id" }
      );
      if (error) throw new Error(`Existing user update failed: ${error.message}`);
    }

    if (groups.length > 0) {
      const { error } = await supabase.from("scim_groups").insert(
        groups.map((g) => ({ id: g.id, display_name: g.displayName, resource: g, tenantId: userId }))
      );
      if (error) throw new Error(`Group insertion failed: ${error.message}`);
    }

    if (entitlements.length > 0) {
      const { error } = await supabase.from("scim_entitlements").insert(
        entitlements.map((e) => ({ id: e.id, display_name: e.displayName, resource: e, tenantId: userId }))
      );
      if (error) throw new Error(`Entitlement insertion failed: ${error.message}`);
    }

    if (roles.length > 0) {
      const { error } = await supabase.from("scim_roles").insert(
        roles.map((r) => ({ id: r.id, display_name: r.displayName, resource: r, tenantId: userId }))
      );
      if (error) throw new Error(`Role insertion failed: ${error.message}`);
    }
  }
}
