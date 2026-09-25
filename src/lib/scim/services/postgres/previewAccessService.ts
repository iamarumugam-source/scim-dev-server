import { getPool } from "../../db-postgres";

export interface PreviewUser {
  userId:  string;
  label:   string | null;
  addedAt: string;
}

interface Row { user_id: string; label: string | null; added_at: string | Date }

export class PreviewAccessService {
  async list(): Promise<PreviewUser[]> {
    const pool = getPool();
    const res = await pool.query(
      "SELECT user_id, label, added_at FROM preview_access ORDER BY added_at ASC",
    );
    return res.rows.map((r: Row) => ({
      userId:  r.user_id,
      label:   r.label ?? null,
      addedAt: new Date(r.added_at).toISOString(),
    }));
  }

  /** Empty allowlist = bootstrap: everyone is allowed until the first entry lands. */
  async isEmpty(): Promise<boolean> {
    const pool = getPool();
    const res = await pool.query("SELECT 1 FROM preview_access LIMIT 1");
    return res.rows.length === 0;
  }

  async isAllowed(userId: string): Promise<boolean> {
    const pool = getPool();
    const res = await pool.query(
      "SELECT 1 FROM preview_access WHERE user_id = $1 LIMIT 1",
      [userId],
    );
    return res.rows.length > 0;
  }

  async add(userId: string, label: string | null): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO preview_access (user_id, label) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET label = EXCLUDED.label`,
      [userId, label],
    );
  }

  async remove(userId: string): Promise<void> {
    const pool = getPool();
    await pool.query("DELETE FROM preview_access WHERE user_id = $1", [userId]);
  }
}
