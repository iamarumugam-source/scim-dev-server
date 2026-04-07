import { getPool } from "../../db-postgres";

export class AnalyticsService {
  async recordPageView(userId: string, path: string): Promise<void> {
    const pool = getPool();
    try {
      await pool.query(
        `INSERT INTO scim_page_views ("tenantId", path, count, updated_at)
         VALUES ($1, $2, 1, NOW())
         ON CONFLICT ("tenantId", path)
         DO UPDATE SET count = scim_page_views.count + 1, updated_at = NOW()`,
        [userId, path],
      );
    } catch (err: any) {
      console.warn("[analytics] Could not record page view:", err.message);
    }
  }
}
