-- scim_logs: stores inbound SCIM API request/response pairs for debugging.
-- Logs are considered temporary diagnostic data; purge old rows as needed.
--
-- Idempotent: safe to run whether the table is brand-new or already exists.

-- 1. Create the table if it doesn't exist yet
CREATE TABLE IF NOT EXISTS scim_logs (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT        NOT NULL,
  log_data   JSONB       NOT NULL,
  response   JSONB       NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Add the id column to an existing table that was created without it
ALTER TABLE scim_logs
  ADD COLUMN IF NOT EXISTS id UUID DEFAULT gen_random_uuid();

-- Backfill any rows that were inserted before the column existed
UPDATE scim_logs SET id = gen_random_uuid() WHERE id IS NULL;

-- Make it NOT NULL now that all rows have a value
ALTER TABLE scim_logs ALTER COLUMN id SET NOT NULL;

-- 3. Fast lookup by tenant, newest-first (used by the log viewer)
CREATE INDEX IF NOT EXISTS scim_logs_tenant_created
  ON scim_logs ("tenantId", created_at DESC);

-- 4. Enable RLS (service-role key bypasses it; anon key cannot read logs)
ALTER TABLE scim_logs ENABLE ROW LEVEL SECURITY;

-- No public policies — all access goes through the service-role key in API routes
