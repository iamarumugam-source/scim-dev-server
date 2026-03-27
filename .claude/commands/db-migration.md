Create a new Supabase SQL migration file for this project.

The user will describe the schema change they need (e.g. "add a scim_widgets table" or "add a status column to scim_users").

Steps:
1. Determine the next migration filename by listing `supabase/migrations/` and incrementing the timestamp prefix (format: `YYYYMMDDHHmmss_<description>.sql`).
2. Write the SQL migration to `supabase/migrations/<filename>.sql` following these conventions:
   - Tables: snake_case names, UUID primary keys (`id UUID PRIMARY KEY DEFAULT gen_random_uuid()`), `created_at TIMESTAMPTZ DEFAULT NOW()`, `last_modified_at TIMESTAMPTZ DEFAULT NOW()`.
   - SCIM resource tables: include a `resource JSONB` column for the full resource object, plus dedicated indexed columns for frequently-queried fields (`tenantId TEXT NOT NULL`, `active BOOLEAN`, display names, etc.).
   - Multi-tenant tables: add `UNIQUE(tenantId, <name_field>)` and an index on `tenantId`.
   - Always enable Row-Level Security: `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;`
   - Add a permissive service-role policy so server-side code works:
     ```sql
     CREATE POLICY "service_role_all" ON <table>
       USING (auth.role() = 'service_role')
       WITH CHECK (auth.role() = 'service_role');
     ```
   - For additive changes (new column) use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`.
   - Never use destructive DDL (`DROP TABLE`, `DROP COLUMN`) without an explicit user instruction.
3. Show the SQL to the user before writing it and confirm it matches their intent.

Ask the user: what is the table/column name, what columns are needed, and are there any unique constraints or indexes required?
