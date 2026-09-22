import { supabase } from "../../db";

// Days of exact per-day call counts to return: 7 to chart, plus the 7 before
// that so the caller can compute a week-over-week delta.
export const DAILY_WINDOW = 14;

export interface StatsRawData {
  logs: Array<{ log_data: unknown; response: unknown; created_at: string }>;
  totalCalls: number;
  // Counted in the DB, not derived from a fetched array: PostgREST caps rows
  // at 1000, so counting client-side under-reported any tenant above that.
  totalUsers: number;
  activeUsers: number;
  // Exact per-day call counts, oldest → newest, length DAILY_WINDOW.
  //
  // These must NOT be derived from the `logs` sample above. That sample is the
  // most recent 1000 rows, so on a tenant doing >1000 calls a day it spans only
  // a few hours — and every older day would read as 0, drawing a cliff to zero
  // that looks like traffic stopped. A time axis implies full coverage of its
  // range, so sampling by recency makes the series actively wrong rather than
  // merely imprecise.
  dailyCounts: Array<{ date: string; count: number }>;
  totalGroups: number;
  totalKeys: number;
  analytics: Array<{ path: string; count: number }>;
  totalEntitlements: number;
  totalRoles: number;
  settings: { rate_limit_enabled: boolean; rate_limit_max: number } | null;
}

// Local-midnight boundaries for the last `days` days, oldest first.
export function dayBoundaries(days: number): { date: string; from: Date; to: Date }[] {
  return Array.from({ length: days }, (_, i) => {
    const from = new Date();
    from.setDate(from.getDate() - (days - 1 - i));
    from.setHours(0, 0, 0, 0);
    const to = new Date(from);
    to.setDate(to.getDate() + 1);
    return { date: from.toISOString().split("T")[0], from, to };
  });
}

export class StatsService {
  // One exact COUNT per day. PostgREST cannot GROUP BY, and adding an RPC would
  // make the dashboard depend on a migration being applied first — so these run
  // as parallel head-only counts instead: no migration, exact, and the extra
  // round-trips overlap into roughly one.
  private async getDailyCounts(userId: string) {
    const days = dayBoundaries(DAILY_WINDOW);
    const results = await Promise.all(
      days.map(({ from, to }) =>
        supabase
          .from("scim_logs")
          .select("id", { count: "exact", head: true })
          .eq("tenantId", userId)
          .gte("created_at", from.toISOString())
          .lt("created_at", to.toISOString()),
      ),
    );
    return days.map((d, i) => ({ date: d.date, count: results[i].count ?? 0 }));
  }

  async getStatsData(userId: string): Promise<StatsRawData> {
    // Kick the per-day counts off first without awaiting, so they run alongside
    // the batch below rather than after it. Kept as a separate statement instead
    // of nesting a second Promise.all inside the destructure — that read badly.
    const dailyCountsPromise = this.getDailyCounts(userId);

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

    const dailyCounts = await dailyCountsPromise;

    return {
      logs:             (logsRecent.data          ?? []) as StatsRawData["logs"],
      totalCalls:       logsTotalResult.count      ?? 0,
      totalUsers:       usersTotalResult.count      ?? 0,
      activeUsers:      usersActiveResult.count     ?? 0,
      dailyCounts,
      totalGroups:      groupsResult.count         ?? 0,
      totalKeys:        keysResult.count           ?? 0,
      analytics:        (analyticsResult.data      ?? []) as StatsRawData["analytics"],
      totalEntitlements: entitlementsResult.count  ?? 0,
      totalRoles:       rolesResult.count          ?? 0,
      settings:         settingsResult.data        ?? null,
    };
  }
}
