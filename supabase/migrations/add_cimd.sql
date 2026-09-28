-- Client ID Metadata Document (CIMD) tooling.
--
-- Serves an OAuth Client ID Metadata Document (draft-ietf-oauth-client-id-
-- metadata-document) at a stable per-tenant URL, so that URL can be used as the
-- client_id in Okta and Okta dereferences it to fetch the client's metadata
-- dynamically. Config is per tenant; fetches are logged so you can confirm Okta
-- actually retrieved the document.
--
-- Not in tenant_settings, whose GET is unauthenticated by design.

CREATE TABLE IF NOT EXISTS cimd_config (
  "tenantId"          TEXT        PRIMARY KEY,
  client_name         TEXT        NOT NULL DEFAULT 'SCIM Dev Server — CIMD test',
  redirect_uris       JSONB       NOT NULL DEFAULT '[]'::jsonb,
  scopes              TEXT        NOT NULL DEFAULT 'openid profile email',
  -- Only shared-secret-free methods are legal in a CIMD document.
  token_endpoint_auth_method TEXT NOT NULL DEFAULT 'none',
  jwks                JSONB,               -- required only for private_key_jwt
  client_uri          TEXT,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Each dereference of the document — timestamp, user-agent, IP. Confirms Okta
-- (or anything) fetched the client_id URL. Decoded metadata only, no secrets.
CREATE TABLE IF NOT EXISTS cimd_fetch_log (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"  TEXT        NOT NULL,
  fetched_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent  TEXT,
  ip          TEXT
);

CREATE INDEX IF NOT EXISTS idx_cimd_fetch_tenant_time
  ON cimd_fetch_log ("tenantId", fetched_at DESC);
