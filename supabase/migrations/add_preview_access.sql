-- Labs / preview access allowlist.
--
-- Controls which accounts see the experimental "Labs" tools in the sidebar. This
-- is a nav-visibility gate, not route protection — the preview pages remain
-- reachable by URL, but each operates only on the caller's own tenant.
--
-- Global (not per-tenant): the rows are the accounts allowed to see Labs, keyed
-- by the account's user id. No id is seeded here — the first entry is added from
-- the UI using the live session, so no identifier is written into source.

CREATE TABLE IF NOT EXISTS preview_access (
  user_id   TEXT        PRIMARY KEY,
  label     TEXT,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
