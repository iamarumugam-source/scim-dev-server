import { getPool } from "../../db-postgres";
import { v4 as uuidv4 } from "uuid";

const API_KEY_PREFIX = "scim_";

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder   = new TextEncoder();
  const data      = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray  = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class ApiKeyService {
  public async generateKey(
    name: string,
    userId: string,
  ): Promise<{ rawKey: string; id: string }> {
    if (!name) throw new Error("API key name is required.");

    const rawKey    = `${API_KEY_PREFIX}${uuidv4().replace(/-/g, "")}`;
    const hashedKey = await hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const pool   = getPool();
    const result = await pool.query(
      `INSERT INTO api_keys (name, hashed_key, key_prefix, raw_key, "tenantId")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name, hashedKey, keyPrefix, rawKey, userId],
    );

    return { rawKey, id: result.rows[0].id };
  }

  public async validateKey(rawKey: string): Promise<boolean> {
    if (!rawKey) return false;

    const hashedKey = await hashApiKey(rawKey);
    const pool      = getPool();

    const result = await pool.query(
      'SELECT id FROM api_keys WHERE hashed_key = $1',
      [hashedKey],
    );

    return result.rows.length > 0;
  }

  public async findKey(
    rawKey: string,
  ): Promise<{ id: string; name: string } | null> {
    if (!rawKey) return null;

    const hashedKey = await hashApiKey(rawKey);
    const pool      = getPool();

    const result = await pool.query(
      'SELECT id, name FROM api_keys WHERE hashed_key = $1',
      [hashedKey],
    );

    return result.rows[0]
      ? { id: result.rows[0].id, name: result.rows[0].name }
      : null;
  }

  public async getKeys(
    userId: string,
  ): Promise<{ id: string; name: string; key_prefix: string; raw_key: string | null; created_at: string }[]> {
    const pool = getPool();

    const result = await pool.query(
      `SELECT id, name, key_prefix, raw_key, created_at
       FROM api_keys
       WHERE "tenantId" = $1
       ORDER BY created_at DESC`,
      [userId],
    );

    return result.rows;
  }

  public async revokeKey(id: string): Promise<boolean> {
    const pool   = getPool();
    const result = await pool.query(
      'DELETE FROM api_keys WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }
}
