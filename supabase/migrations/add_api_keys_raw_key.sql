-- Store the raw API key so it can be shown again in the UI (dev/troubleshooting only).
-- Keys created before this migration have NULL here and cannot be recovered.
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS raw_key TEXT;
