import { supabase } from "../../db";

export interface ResetSelections {
  users?:        boolean;
  groups?:       boolean;
  entitlements?: boolean;
  roles?:        boolean;
  logs?:         boolean;
  pageViews?:    boolean;
}

export class ResourceResetService {
  async reset(userId: string, selections: ResetSelections): Promise<void> {
    const resetAll = Object.keys(selections).length === 0;
    const should = (key: keyof ResetSelections) => resetAll || selections[key] === true;

    if (should("roles")) {
      const { error } = await supabase.from("scim_roles").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete roles: ${error.message}`);
    }

    if (should("entitlements")) {
      const { error } = await supabase.from("scim_entitlements").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete entitlements: ${error.message}`);
    }

    if (should("groups")) {
      const { error } = await supabase.from("scim_groups").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete groups: ${error.message}`);
    }

    if (should("users")) {
      const { error } = await supabase.from("scim_users").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete users: ${error.message}`);
    }

    if (should("logs")) {
      const { error } = await supabase.from("scim_logs").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete logs: ${error.message}`);
    }

    if (should("pageViews")) {
      const { error } = await supabase.from("scim_page_views").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete page views: ${error.message}`);
    }
  }
}
