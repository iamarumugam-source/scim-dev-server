import { getPool } from "../../db-postgres";

export interface LogEntry {
  id: string;
  log_data: unknown;
  response: unknown;
  created_at: string;
}

export class LogService {
  async insertLog(
    userId: string,
    requestData: unknown,
    responseData: unknown,
  ): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO scim_logs ("tenantId", log_data, response) VALUES ($1, $2, $3)`,
      [userId, JSON.stringify(requestData), JSON.stringify(responseData)],
    );
  }

  async deleteLogs(userId: string): Promise<void> {
    const pool = getPool();
    await pool.query('DELETE FROM scim_logs WHERE "tenantId" = $1', [userId]);
  }

  async getLogs(
    userId: string,
    limit: number,
    offset: number,
  ): Promise<{ logs: LogEntry[]; total: number }> {
    const pool   = getPool();
    const result = await pool.query(
      `SELECT id, log_data, response, created_at, COUNT(*) OVER()::int AS total_count
       FROM scim_logs
       WHERE "tenantId" = $1
       ORDER BY created_at DESC
       OFFSET $2 LIMIT $3`,
      [userId, offset, limit],
    );

    const total = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const logs  = result.rows.map((r: any) => ({
      id:         r.id,
      log_data:   r.log_data,
      response:   r.response,
      created_at: r.created_at,
    }));

    return { logs, total };
  }
}
