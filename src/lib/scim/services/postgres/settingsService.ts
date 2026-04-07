import { getPool } from "../../db-postgres";

export interface TenantSettings {
  rateLimitEnabled: boolean;
  rateLimitMax: number;
}

export class SettingsService {
  async getSettings(userId: string): Promise<TenantSettings> {
    const pool   = getPool();
    const result = await pool.query(
      'SELECT rate_limit_enabled, rate_limit_max FROM tenant_settings WHERE "tenantId" = $1',
      [userId],
    );

    const row = result.rows[0];
    return {
      rateLimitEnabled: row?.rate_limit_enabled ?? true,
      rateLimitMax:     row?.rate_limit_max     ?? 60,
    };
  }

  async updateSettings(
    userId: string,
    enabled: boolean,
    maxPerMinute: number,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO tenant_settings ("tenantId", rate_limit_enabled, rate_limit_max, updated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT ("tenantId")
       DO UPDATE SET rate_limit_enabled = $2, rate_limit_max = $3, updated_at = NOW()`,
      [userId, enabled, maxPerMinute],
    );
  }
}
