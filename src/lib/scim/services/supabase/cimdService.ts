import { supabase } from "../../db";

export interface CimdConfig {
  clientName:   string;
  redirectUris:  string[];
  scopes:       string;
  authMethod:   string;
  grantTypes:   string[];
  jwks:         unknown | null;
  jwksUri:      string | null;
  clientUri:    string | null;
  logoUri:      string | null;
  policyUri:    string | null;
  tosUri:       string | null;
  updatedAt:    string | null;
}

export interface CimdFetch {
  id:        string;
  fetchedAt: string;
  userAgent: string | null;
  ip:        string | null;
}

export class CimdService {
  async getConfig(tenantId: string): Promise<CimdConfig | null> {
    const { data, error } = await supabase
      .from("cimd_config")
      .select("*")
      .eq("tenantId", tenantId)
      .maybeSingle();
    if (error) throw new Error(`Supabase error reading CIMD config: ${error.message}`);
    return data ? mapConfig(data) : null;
  }

  async saveConfig(tenantId: string, input: Partial<CimdConfig>): Promise<CimdConfig> {
    const row: Record<string, unknown> = {
      tenantId,
      client_name:                input.clientName ?? "SCIM Dev Server — CIMD test",
      redirect_uris:              JSON.stringify(input.redirectUris ?? []),
      scopes:                     input.scopes ?? "openid profile email",
      token_endpoint_auth_method: input.authMethod ?? "none",
      grant_types:                JSON.stringify(input.grantTypes ?? ["authorization_code"]),
      jwks:                       input.jwks ?? null,
      jwks_uri:                   input.jwksUri ?? null,
      client_uri:                 input.clientUri ?? null,
      logo_uri:                   input.logoUri ?? null,
      policy_uri:                 input.policyUri ?? null,
      tos_uri:                    input.tosUri ?? null,
      updated_at:                 new Date().toISOString(),
    };

    const { error } = await supabase
      .from("cimd_config")
      .upsert(row, { onConflict: "tenantId" });
    if (error) throw new Error(`Supabase error saving CIMD config: ${error.message}`);

    const saved = await this.getConfig(tenantId);
    if (!saved) throw new Error("CIMD config did not persist.");
    return saved;
  }

  async recordFetch(tenantId: string, userAgent: string | null, ip: string | null): Promise<void> {
    await supabase
      .from("cimd_fetch_log")
      .insert({ tenantId, user_agent: userAgent, ip });
  }

  async listFetches(tenantId: string, limit = 20): Promise<CimdFetch[]> {
    const { data, error } = await supabase
      .from("cimd_fetch_log")
      .select("id, fetched_at, user_agent, ip")
      .eq("tenantId", tenantId)
      .order("fetched_at", { ascending: false })
      .limit(limit);
    if (error) throw new Error(`Supabase error reading CIMD fetches: ${error.message}`);
    return (data ?? []).map((r) => ({
      id:        r.id as string,
      fetchedAt: r.fetched_at as string,
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
    grantTypes:  (() => {
      try { const g = typeof r.grant_types === "string" ? JSON.parse(r.grant_types) : r.grant_types;
            return Array.isArray(g) ? g : ["authorization_code"]; }
      catch { return ["authorization_code"]; }
    })(),
    jwksUri:     (r.jwks_uri as string | null) ?? null,
    clientUri:   (r.client_uri as string | null) ?? null,
    logoUri:     (r.logo_uri as string | null) ?? null,
    policyUri:   (r.policy_uri as string | null) ?? null,
    tosUri:      (r.tos_uri as string | null) ?? null,
    updatedAt:   r.updated_at ? String(r.updated_at) : null,
  };
}
