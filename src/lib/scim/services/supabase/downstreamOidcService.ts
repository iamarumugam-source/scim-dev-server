import { supabase } from "../../db";

const CONFIG_TABLE   = "downstream_oidc_config";
const ATTEMPTS_TABLE = "downstream_login_attempts";

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

interface Row {
  issuer?:        string;
  client_id?:     string;
  client_secret?: string | null;
  scopes?:        string;
  updated_at?:    string;
}

function toConfig(row: Row): DownstreamOidcConfig {
  return {
    issuer:    row.issuer ?? "",
    clientId:  row.client_id ?? "",
    scopes:    row.scopes ?? "openid profile email",
    hasSecret: Boolean(row.client_secret),
    updatedAt: row.updated_at ?? null,
  };
}

export class DownstreamOidcService {
  /** Safe for any authenticated caller: omits client_secret entirely. */
  async getConfig(tenantId: string): Promise<DownstreamOidcConfig | null> {
    const { data, error } = await supabase
      .from(CONFIG_TABLE)
      .select("issuer, client_id, client_secret, scopes, updated_at")
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (error) throw new Error(`Supabase error reading downstream config: ${error.message}`);
    return data ? toConfig(data as Row) : null;
  }

  /**
   * Includes the secret. Only the token exchange may call this — it must never
   * reach a response body.
   */
  async getConfigWithSecret(tenantId: string): Promise<DownstreamOidcConfigWithSecret | null> {
    const { data, error } = await supabase
      .from(CONFIG_TABLE)
      .select("issuer, client_id, client_secret, scopes, updated_at")
      .eq("tenantId", tenantId)
      .maybeSingle();

    if (error) throw new Error(`Supabase error reading downstream config: ${error.message}`);
    if (!data) return null;
    const row = data as Row;
    return { ...toConfig(row), clientSecret: row.client_secret ?? null };
  }

  /**
   * An omitted or empty `clientSecret` leaves any stored value untouched, so the
   * UI can save the other fields without the operator re-typing a secret it
   * deliberately never showed them.
   */
  async saveConfig(
    tenantId: string,
    input: { issuer: string; clientId: string; scopes?: string; clientSecret?: string | null },
  ): Promise<DownstreamOidcConfig> {
    const row: Record<string, unknown> = {
      tenantId,
      issuer:     input.issuer,
      client_id:  input.clientId,
      scopes:     input.scopes?.trim() || "openid profile email",
      updated_at: new Date().toISOString(),
    };
    if (input.clientSecret != null && input.clientSecret !== "") {
      row.client_secret = input.clientSecret;
    }

    const { error } = await supabase
      .from(CONFIG_TABLE)
      .upsert(row, { onConflict: "tenantId" });

    if (error) throw new Error(`Supabase error saving downstream config: ${error.message}`);

    const saved = await this.getConfig(tenantId);
    if (!saved) throw new Error("Config did not persist.");
    return saved;
  }

  /** Stores decoded claims only — raw tokens are never persisted. */
  async recordAttempt(tenantId: string, a: LoginAttemptInput): Promise<string> {
    const { data, error } = await supabase
      .from(ATTEMPTS_TABLE)
      .insert({
        tenantId,
        outcome:              a.outcome,
        error:                a.error ?? null,
        initiated_by:         a.initiatedBy,
        id_token_claims:      a.idTokenClaims ?? null,
        userinfo:             a.userinfo ?? null,
        matched_scim_user_id: a.matchedScimUserId ?? null,
      })
      .select("id")
      .single();

    if (error) throw new Error(`Supabase error recording login attempt: ${error.message}`);
    return (data as { id: string }).id;
  }

  async getAttempt(tenantId: string, id: string): Promise<LoginAttempt | null> {
    const { data, error } = await supabase
      .from(ATTEMPTS_TABLE)
      .select("*")
      .eq("tenantId", tenantId)
      .eq("id", id)
      .maybeSingle();

    // 22P02 is an invalid uuid — treat a malformed id as "not found" rather than
    // a server error, matching how the other services handle it.
    if (error?.code === "22P02") return null;
    if (error) throw new Error(`Supabase error reading login attempt: ${error.message}`);
    return data ? mapAttempt(data as Record<string, unknown>) : null;
  }

  async listAttempts(tenantId: string, limit = 10): Promise<LoginAttempt[]> {
    const { data, error } = await supabase
      .from(ATTEMPTS_TABLE)
      .select("*")
      .eq("tenantId", tenantId)
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) throw new Error(`Supabase error listing login attempts: ${error.message}`);
    return (data ?? []).map((r) => mapAttempt(r as Record<string, unknown>));
  }
}

function mapAttempt(r: Record<string, unknown>): LoginAttempt {
  return {
    id:                String(r.id),
    createdAt:         String(r.created_at),
    outcome:           r.outcome as "success" | "error",
    error:             (r.error as string | null) ?? null,
    initiatedBy:       (r.initiated_by as "sp" | "idp") ?? "sp",
    idTokenClaims:     (r.id_token_claims as Record<string, unknown> | null) ?? null,
    userinfo:          (r.userinfo as Record<string, unknown> | null) ?? null,
    matchedScimUserId: (r.matched_scim_user_id as string | null) ?? null,
  };
}
