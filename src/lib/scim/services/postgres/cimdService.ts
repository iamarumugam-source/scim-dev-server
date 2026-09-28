import { getPool } from "../../db-postgres";

export interface CimdConfig {
  clientName:  string;
  redirectUris: string[];
  scopes:      string;
  authMethod:  string;
  jwks:        unknown | null;
  clientUri:   string | null;
  updatedAt:   string | null;
}

export interface CimdFetch {
  id:        string;
  fetchedAt: string;
  userAgent: string | null;
  ip:        string | null;
}

export class CimdService {
  async getConfig(tenantId: string): Promise<CimdConfig | null> {
    const pool = getPool();
    const res = await pool.query(
      "SELECT * FROM cimd_config WHERE \"tenantId\" = $1", [tenantId]);
    return res.rows.length ? mapConfig(res.rows[0]) : null;
  }

  async saveConfig(tenantId: string, input: Partial<CimdConfig>): Promise<CimdConfig> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO cimd_config
        ("tenantId", client_name, redirect_uris, scopes, token_endpoint_auth_method, jwks, client_uri, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
       ON CONFLICT ("tenantId") DO UPDATE SET
        client_name = EXCLUDED.client_name,
        redirect_uris = EXCLUDED.redirect_uris,
        scopes = EXCLUDED.scopes,
        token_endpoint_auth_method = EXCLUDED.token_endpoint_auth_method,
        jwks = EXCLUDED.jwks,
        client_uri = EXCLUDED.client_uri,
        updated_at = NOW()`,
      [
        tenantId,
        input.clientName ?? "SCIM Dev Server — CIMD test",
        JSON.stringify(input.redirectUris ?? []),
        input.scopes ?? "openid profile email",
        input.authMethod ?? "none",
        input.jwks ? JSON.stringify(input.jwks) : null,
        input.clientUri ?? null,
      ],
    );
    const saved = await this.getConfig(tenantId);
    if (!saved) throw new Error("CIMD config did not persist.");
    return saved;
  }

  async recordFetch(tenantId: string, userAgent: string | null, ip: string | null): Promise<void> {
    const pool = getPool();
    await pool.query(
      `INSERT INTO cimd_fetch_log ("tenantId", user_agent, ip) VALUES ($1, $2, $3)`,
      [tenantId, userAgent, ip],
    );
  }

  async listFetches(tenantId: string, limit = 20): Promise<CimdFetch[]> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT id, fetched_at, user_agent, ip FROM cimd_fetch_log
        WHERE "tenantId" = $1 ORDER BY fetched_at DESC LIMIT $2`,
      [tenantId, limit],
    );
    return res.rows.map((r: Record<string, unknown>) => ({
      id:        String(r.id),
      fetchedAt: new Date(r.fetched_at as string).toISOString(),
      userAgent: (r.user_agent as string | null) ?? null,
      ip:        (r.ip as string | null) ?? null,
    }));
  }
}

function mapConfig(r: Record<string, unknown>): CimdConfig {
  let uris: string[] = [];
  try { uris = typeof r.redirect_uris === "string" ? JSON.parse(r.redirect_uris) : (r.redirect_uris as string[]); }
  catch { uris = []; }
  return {
    clientName:  String(r.client_name ?? ""),
    redirectUris: Array.isArray(uris) ? uris : [],
    scopes:      String(r.scopes ?? "openid profile email"),
    authMethod:  String(r.token_endpoint_auth_method ?? "none"),
    jwks:        r.jwks ?? null,
    clientUri:   (r.client_uri as string | null) ?? null,
    updatedAt:   r.updated_at ? new Date(r.updated_at as string).toISOString() : null,
  };
}
