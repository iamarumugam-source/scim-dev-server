import { getPool } from "../../db-postgres";

/** Config as the API is allowed to return it — the secret is never included. */
export interface DownstreamOidcConfig {
  issuer:    string;
  clientId:  string;
  scopes:    string;
  hasSecret: boolean;
  updatedAt: string | null;
}

/** Server-only. Reachable solely from the callback route's token exchange. */
export interface DownstreamOidcConfigWithSecret extends DownstreamOidcConfig {
  clientSecret: string | null;
}

export interface LoginAttemptInput {
  outcome:            "success" | "error";
  error?:             string | null;
  initiatedBy:        "sp" | "idp";
  idTokenClaims?:     Record<string, unknown> | null;
  userinfo?:          Record<string, unknown> | null;
  matchedScimUserId?: string | null;
}

export interface LoginAttempt extends LoginAttemptInput {
  id:        string;
  createdAt: string;
}

interface ConfigRow {
  issuer: string; client_id: string; client_secret: string | null;
  scopes: string; updated_at: string | Date | null;
}
interface AttemptRow {
  id: string; created_at: string | Date; outcome: "success" | "error";
  error: string | null; initiated_by: "sp" | "idp";
  id_token_claims: Record<string, unknown> | null;
  userinfo: Record<string, unknown> | null; matched_scim_user_id: string | null;
}

function toConfig(r: ConfigRow): DownstreamOidcConfig {
  return {
    issuer:    r.issuer ?? "",
    clientId:  r.client_id ?? "",
    scopes:    r.scopes ?? "openid profile email",
    hasSecret: Boolean(r.client_secret),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
  };
}

function mapAttempt(r: AttemptRow): LoginAttempt {
  return {
    id:                String(r.id),
    createdAt:         new Date(r.created_at).toISOString(),
    outcome:           r.outcome,
    error:             r.error ?? null,
    initiatedBy:       r.initiated_by ?? "sp",
    idTokenClaims:     r.id_token_claims ?? null,
    userinfo:          r.userinfo ?? null,
    matchedScimUserId: r.matched_scim_user_id ?? null,
  };
}

export class DownstreamOidcService {
  async getConfig(tenantId: string): Promise<DownstreamOidcConfig | null> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT issuer, client_id, client_secret, scopes, updated_at
         FROM downstream_oidc_config WHERE "tenantId" = $1`,
      [tenantId],
    );
    return res.rows.length ? toConfig(res.rows[0]) : null;
  }

  async getConfigWithSecret(tenantId: string): Promise<DownstreamOidcConfigWithSecret | null> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT issuer, client_id, client_secret, scopes, updated_at
         FROM downstream_oidc_config WHERE "tenantId" = $1`,
      [tenantId],
    );
    if (!res.rows.length) return null;
    const r = res.rows[0];
    return { ...toConfig(r), clientSecret: r.client_secret ?? null };
  }

  /**
   * An omitted or empty `clientSecret` leaves any stored value untouched, so the
   * UI can save the other fields without the operator re-typing a secret it
   * deliberately never showed them. COALESCE on EXCLUDED does that in one
   * statement.
   */
  async saveConfig(
    tenantId: string,
    input: { issuer: string; clientId: string; scopes?: string; clientSecret?: string | null },
  ): Promise<DownstreamOidcConfig> {
    const pool = getPool();
    const secret = input.clientSecret != null && input.clientSecret !== "" ? input.clientSecret : null;

    await pool.query(
      `INSERT INTO downstream_oidc_config
              ("tenantId", issuer, client_id, client_secret, scopes, updated_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT ("tenantId") DO UPDATE
          SET issuer        = EXCLUDED.issuer,
              client_id     = EXCLUDED.client_id,
              client_secret = COALESCE(EXCLUDED.client_secret, downstream_oidc_config.client_secret),
              scopes        = EXCLUDED.scopes,
              updated_at    = NOW()`,
      [tenantId, input.issuer, input.clientId, secret, input.scopes?.trim() || "openid profile email"],
    );

    const saved = await this.getConfig(tenantId);
    if (!saved) throw new Error("Config did not persist.");
    return saved;
  }

  /** Stores decoded claims only — raw tokens are never persisted. */
  async recordAttempt(tenantId: string, a: LoginAttemptInput): Promise<string> {
    const pool = getPool();
    const res = await pool.query(
      `INSERT INTO downstream_login_attempts
              ("tenantId", outcome, error, initiated_by, id_token_claims, userinfo, matched_scim_user_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        tenantId,
        a.outcome,
        a.error ?? null,
        a.initiatedBy,
        a.idTokenClaims ?? null,
        a.userinfo ?? null,
        a.matchedScimUserId ?? null,
      ],
    );
    return String(res.rows[0].id);
  }

  async getAttempt(tenantId: string, id: string): Promise<LoginAttempt | null> {
    const pool = getPool();
    try {
      const res = await pool.query(
        `SELECT * FROM downstream_login_attempts WHERE "tenantId" = $1 AND id = $2`,
        [tenantId, id],
      );
      return res.rows.length ? mapAttempt(res.rows[0]) : null;
    } catch (err: any) {
      // 22P02 is an invalid uuid — a malformed id is "not found", not a 500.
      if (err.code === "22P02") return null;
      throw err;
    }
  }

  async listAttempts(tenantId: string, limit = 10): Promise<LoginAttempt[]> {
    const pool = getPool();
    const res = await pool.query(
      `SELECT * FROM downstream_login_attempts
        WHERE "tenantId" = $1
        ORDER BY created_at DESC
        LIMIT $2`,
      [tenantId, limit],
    );
    return res.rows.map(mapAttempt);
  }
}
