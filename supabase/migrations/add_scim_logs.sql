-- scim_logs: stores inbound SCIM API request/response pairs for debugging.
-- Logs are considered temporary diagnostic data; purge old rows as needed.

CREATE TABLE IF NOT EXISTS scim_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT        NOT NULL,
  log_data   JSONB       NOT NULL,
  response   JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast lookup by tenant, newest-first (used by the log viewer)
CREATE INDEX IF NOT EXISTS scim_logs_tenant_created
  ON scim_logs ("tenantId", created_at DESC);

-- Enable RLS (service-role key bypasses it; anon key cannot read logs)
ALTER TABLE scim_logs ENABLE ROW LEVEL SECURITY;

-- No public policies — all access goes through the service-role key in API routes
