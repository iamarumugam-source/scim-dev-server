CREATE TABLE IF NOT EXISTS scim_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL,
  display_name TEXT NOT NULL,
  resource JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_modified_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE("tenantId", display_name)
);

CREATE INDEX IF NOT EXISTS idx_scim_entitlements_tenant ON scim_entitlements ("tenantId");
