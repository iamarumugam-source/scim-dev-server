-- One row per (tenant, path) — a counter, not an event log.
CREATE TABLE IF NOT EXISTS "arumugam-personal".scim_page_views (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT    NOT NULL,
  path       TEXT    NOT NULL,
  count      INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE ("tenantId", path)
);

CREATE INDEX IF NOT EXISTS idx_scim_page_views_tenant ON "arumugam-personal".scim_page_views ("tenantId");

-- Atomic upsert: insert with count=1, or increment on conflict.
CREATE OR REPLACE FUNCTION "arumugam-personal".increment_page_view(p_tenant_id TEXT, p_path TEXT)
RETURNS void AS $$
  INSERT INTO "arumugam-personal".scim_page_views AS spv ("tenantId", path, count, updated_at)
  VALUES (p_tenant_id, p_path, 1, NOW())
  ON CONFLICT ("tenantId", path)
  DO UPDATE SET count = spv.count + 1, updated_at = NOW();
$$ LANGUAGE sql;
