import { getPool } from "../../db-postgres";

export class LoginActivityService {
  async getActivity(
    userId: string,
    since: Date,
  ): Promise<{ timestamps: string[]; total: number }> {
    const pool = getPool();

    const [activityResult, totalResult] = await Promise.all([
      pool.query(
        `SELECT logged_at FROM login_activity
         WHERE "tenantId" = $1 AND logged_at >= $2
         ORDER BY logged_at ASC`,
        [userId, since.toISOString()],
      ),
      pool.query(
        'SELECT COUNT(*)::int AS cnt FROM login_activity WHERE "tenantId" = $1',
        [userId],
      ),
    ]);

    const timestamps = activityResult.rows.map((r: any) => r.logged_at as string);
    const total      = totalResult.rows[0]?.cnt ?? 0;
    return { timestamps, total };
  }

  async recordLogin(userId: string): Promise<void> {
    const pool = getPool();
    await pool.query(
      'INSERT INTO login_activity ("tenantId") VALUES ($1)',
      [userId],
    );
  }
}
