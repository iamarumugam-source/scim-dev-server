-- Downstream OIDC login test.
--
-- Lets an operator point a second Okta app at this server, sign in as a
-- SCIM-provisioned user, and compare the claims that arrive at login against the
-- record SCIM provisioned.
--
-- NOTE ON PLACEMENT: this config deliberately does NOT live in tenant_settings.
-- GET /api/[userId]/settings is unauthenticated by design — Edge middleware
-- cannot reach the database, so it self-fetches that route to populate its
-- rate-limit cache. Putting a client secret behind that endpoint would be one
-- careless destructure away from leaking it.

-- ── downstream_oidc_config ───────────────────────────────────────────────────
-- client_secret is nullable: a public (SPA/native) Okta app uses PKCE alone and
-- needs no secret. The API never returns this column — callers see hasSecret.

CREATE TABLE IF NOT EXISTS downstream_oidc_config (
  "tenantId"    TEXT        PRIMARY KEY,
  issuer        TEXT        NOT NULL,
  client_id     TEXT        NOT NULL,
  client_secret TEXT,
  scopes        TEXT        NOT NULL DEFAULT 'openid profile email',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── downstream_login_attempts ────────────────────────────────────────────────
-- Stores DECODED CLAIMS ONLY, never raw tokens. These rows describe real people,
-- so treat them with the same care as scim_users.

CREATE TABLE IF NOT EXISTS downstream_login_attempts (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"           TEXT        NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  outcome              TEXT        NOT NULL,
  error                TEXT,
  initiated_by         TEXT        NOT NULL DEFAULT 'sp',
  id_token_claims      JSONB,
  userinfo             JSONB,
  matched_scim_user_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_dla_tenant_created
  ON downstream_login_attempts ("tenantId", created_at DESC);

-- ── scim_users.external_id ───────────────────────────────────────────────────
-- Okta sends externalId on every SCIM user create and this server has been
-- discarding it. It is the canonical IdP↔SP linkage, which is what lets an OIDC
-- `sub` be matched back to a provisioned record rather than guessing on username.

ALTER TABLE scim_users ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE INDEX IF NOT EXISTS idx_scim_users_tenant_external
  ON scim_users ("tenantId", external_id);
