import { supabase } from "../../db";

export interface StatsRawData {
  logs: Array<{ log_data: unknown; response: unknown; created_at: string }>;
  totalCalls: number;
  // Counted in the DB, not derived from a fetched array: PostgREST caps rows
  // at 1000, so counting client-side under-reported any tenant above that.
  totalUsers: number;
  activeUsers: number;
  totalGroups: number;
  totalKeys: number;
  analytics: Array<{ path: string; count: number }>;
  totalEntitlements: number;
  totalRoles: number;
  settings: { rate_limit_enabled: boolean; rate_limit_max: number } | null;
}

export class StatsService {
  async getStatsData(userId: string): Promise<StatsRawData> {
    const [
      logsRecent,
      logsTotalResult,
      usersTotalResult,
      usersActiveResult,
      groupsResult,
      keysResult,
      analyticsResult,
      entitlementsResult,
      rolesResult,
      settingsResult,
    ] = await Promise.all([
      supabase
        .from("scim_logs")
        .select("log_data, response, created_at")
        .eq("tenantId", userId)
        .order("created_at", { ascending: false })
        .limit(1000),

      supabase
        .from("scim_logs")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),

      supabase
        .from("scim_users")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),

      supabase
        .from("scim_users")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId)
        .eq("active", true),

      supabase
        .from("scim_groups")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),

      supabase
        .from("api_keys")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),

      supabase
        .from("scim_page_views")
        .select("path, count")
        .eq("tenantId", userId),

      supabase
        .from("scim_entitlements")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),

      supabase
        .from("scim_roles")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),

      supabase
        .from("tenant_settings")
        .select("rate_limit_enabled, rate_limit_max")
        .eq("tenantId", userId)
        .maybeSingle(),
    ]);

    return {
      logs:             (logsRecent.data          ?? []) as StatsRawData["logs"],
      totalCalls:       logsTotalResult.count      ?? 0,
      totalUsers:       usersTotalResult.count      ?? 0,
      activeUsers:      usersActiveResult.count     ?? 0,
      totalGroups:      groupsResult.count         ?? 0,
      totalKeys:        keysResult.count           ?? 0,
      analytics:        (analyticsResult.data      ?? []) as StatsRawData["analytics"],
      totalEntitlements: entitlementsResult.count  ?? 0,
      totalRoles:       rolesResult.count          ?? 0,
      settings:         settingsResult.data        ?? null,
    };
  }
}
