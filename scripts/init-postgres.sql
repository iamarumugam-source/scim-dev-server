-- ============================================================
-- SCIM Dev Server — local PostgreSQL schema
-- Usage: psql -f scripts/init-postgres.sql
-- No RLS, no Supabase-isms. All tenantId columns are quoted
-- to preserve mixed-case so queries in the app work as-is.
-- ============================================================

-- ── scim_users ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scim_users (
  id               UUID        PRIMARY KEY,
  username         TEXT        NOT NULL,
  external_id      TEXT,
  active           BOOLEAN     NOT NULL DEFAULT true,
  resource         JSONB       NOT NULL,
  "tenantId"       TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scim_users_tenant      ON scim_users ("tenantId");
CREATE INDEX IF NOT EXISTS idx_scim_users_tenant_user ON scim_users ("tenantId", username);

-- ── scim_groups ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scim_groups (
  id               UUID        PRIMARY KEY,
  display_name     TEXT        NOT NULL,
  resource         JSONB       NOT NULL,
  "tenantId"       TEXT        NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE ("tenantId", display_name)
);

CREATE INDEX IF NOT EXISTS idx_scim_groups_tenant ON scim_groups ("tenantId");

-- ── scim_entitlements ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scim_entitlements (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"       TEXT        NOT NULL,
  display_name     TEXT        NOT NULL,
  resource         JSONB       NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("tenantId", display_name)
);

CREATE INDEX IF NOT EXISTS idx_scim_entitlements_tenant ON scim_entitlements ("tenantId");

-- ── scim_roles ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scim_roles (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId"       TEXT        NOT NULL,
  display_name     TEXT        NOT NULL,
  resource         JSONB       NOT NULL,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("tenantId", display_name)
);

CREATE INDEX IF NOT EXISTS idx_scim_roles_tenant ON scim_roles ("tenantId");

-- ── api_keys ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS api_keys (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hashed_key   TEXT        NOT NULL UNIQUE,
  key_prefix   TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  "tenantId"   TEXT        NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_api_keys_tenant     ON api_keys ("tenantId");
CREATE INDEX IF NOT EXISTS idx_api_keys_hashed_key ON api_keys (hashed_key);

-- ── scim_logs ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scim_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT        NOT NULL,
  log_data   JSONB       NOT NULL,
  response   JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scim_logs_tenant_created ON scim_logs ("tenantId", created_at DESC);

-- ── scim_page_views ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS scim_page_views (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT        NOT NULL,
  path       TEXT        NOT NULL,
  count      INTEGER     NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("tenantId", path)
);

CREATE INDEX IF NOT EXISTS idx_scim_page_views_tenant ON scim_page_views ("tenantId");

-- ── scim_schema_extensions ───────────────────────────────────

CREATE TABLE IF NOT EXISTS scim_schema_extensions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT        NOT NULL,
  schema_urn TEXT        NOT NULL,
  enabled    BOOLEAN     NOT NULL DEFAULT true,
  fields     JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scim_schema_ext_tenant ON scim_schema_extensions ("tenantId");

-- ── tenant_settings ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tenant_settings (
  "tenantId"          TEXT    PRIMARY KEY,
  rate_limit_enabled  BOOLEAN NOT NULL DEFAULT true,
  rate_limit_max      INTEGER NOT NULL DEFAULT 60,
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── login_activity ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS login_activity (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT        NOT NULL,
  logged_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_activity_tenant_time ON login_activity ("tenantId", logged_at);

-- ── increment_page_view function ─────────────────────────────
-- Mirrors the Supabase migration in add_page_views_counter.sql.
-- Atomically upserts a page view counter row.

CREATE OR REPLACE FUNCTION increment_page_view(p_tenant_id TEXT, p_path TEXT)
RETURNS void AS $$
  INSERT INTO scim_page_views ("tenantId", path, count, updated_at)
  VALUES (p_tenant_id, p_path, 1, NOW())
  ON CONFLICT ("tenantId", path)
  DO UPDATE SET count = scim_page_views.count + 1, updated_at = NOW();
$$ LANGUAGE sql;

-- ── downstream OIDC login test ───────────────────────────────
-- Mirrors supabase/migrations/add_downstream_oidc.sql.
--
-- Config is deliberately NOT in tenant_settings: GET /api/[userId]/settings is
-- unauthenticated by design (Edge middleware self-fetches it for the rate-limit
-- cache), so a client secret must not sit behind that endpoint.

CREATE TABLE IF NOT EXISTS downstream_oidc_config (
  "tenantId"    TEXT        PRIMARY KEY,
  issuer        TEXT        NOT NULL,
  client_id     TEXT        NOT NULL,
  client_secret TEXT,
  scopes        TEXT        NOT NULL DEFAULT 'openid profile email',
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decoded claims only — never raw tokens.
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

-- Existing databases skip the CREATE above, so add the column explicitly too.
ALTER TABLE scim_users ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE INDEX IF NOT EXISTS idx_scim_users_tenant_external
  ON scim_users ("tenantId", external_id);

