import { getPool } from "../../db-postgres";

export interface StatsRawData {
  logs: Array<{ log_data: unknown; response: unknown; created_at: string }>;
  totalCalls: number;
  // Counted in the DB rather than derived from a fetched array — cheaper, and
  // keeps this shape identical to the supabase implementation.
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
    const pool = getPool();

    const [
      logsResult,
      totalCallsResult,
      totalUsersResult,
      activeUsersResult,
      totalGroupsResult,
      totalKeysResult,
      analyticsResult,
      totalEntitlementsResult,
      totalRolesResult,
      settingsResult,
    ] = await Promise.all([
      pool.query(
        `SELECT log_data, response, created_at
         FROM scim_logs
         WHERE "tenantId" = $1
         ORDER BY created_at DESC
         LIMIT 1000`,
        [userId],
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM scim_logs WHERE "tenantId" = $1',
        [userId],
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM scim_users WHERE "tenantId" = $1',
        [userId],
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM scim_users WHERE "tenantId" = $1 AND active = true',
        [userId],
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM scim_groups WHERE "tenantId" = $1',
        [userId],
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM api_keys WHERE "tenantId" = $1',
        [userId],
      ),
      pool.query(
        'SELECT path, count FROM scim_page_views WHERE "tenantId" = $1',
        [userId],
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM scim_entitlements WHERE "tenantId" = $1',
        [userId],
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM scim_roles WHERE "tenantId" = $1',
        [userId],
      ),
      pool.query(
        'SELECT rate_limit_enabled, rate_limit_max FROM tenant_settings WHERE "tenantId" = $1',
        [userId],
      ),
    ]);

    return {
      logs:              logsResult.rows as StatsRawData["logs"],
      totalCalls:        totalCallsResult.rows[0]?.cnt ?? 0,
      totalUsers:        totalUsersResult.rows[0]?.cnt  ?? 0,
      activeUsers:       activeUsersResult.rows[0]?.cnt ?? 0,
      totalGroups:       totalGroupsResult.rows[0]?.cnt ?? 0,
      totalKeys:         totalKeysResult.rows[0]?.cnt ?? 0,
      analytics:         analyticsResult.rows as StatsRawData["analytics"],
      totalEntitlements: totalEntitlementsResult.rows[0]?.cnt ?? 0,
      totalRoles:        totalRolesResult.rows[0]?.cnt ?? 0,
      settings:          settingsResult.rows[0] ?? null,
    };
  }
}
