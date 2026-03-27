Scaffold a new SCIM service class for this project.

The user will describe the resource (e.g. "a WidgetService for managing widgets").

Steps:
1. Create the file at `src/lib/scim/services/<resource>Service.ts`.
2. Follow the established service pattern:
   - Import the shared `supabase` singleton from `../db`.
   - Export a class named `<Resource>Service`.
   - Every query must filter by `tenantId` (passed as parameter) to enforce tenant isolation.
   - Map Supabase error code `PGRST116` (row not found) and `22P02` (invalid UUID) to `null` — not thrown errors.
   - Wrap all other Supabase errors as `throw new Error(\`Supabase error <operation>: \${error.message}\`)`.
   - Store the full SCIM resource object in a `resource` JSONB column; mirror searchable scalar fields as dedicated columns.
   - Use `uuidv4()` from `uuid` for new resource IDs.
   - Set `meta.created`, `meta.lastModified` to `new Date().toISOString()` on create; update `meta.lastModified` on every mutation.
   - Set `meta.location` to `\${BASE_URL}/api/\${tenantId}/scim/v2/<Resources>/\${id}` using `process.env.NEXT_PUBLIC_BASE_URL`.
3. Implement only the CRUD methods requested (createX, getXs, getXById, updateX, patchX, deleteX, deleteAllXs).
4. If the corresponding Supabase table doesn't exist yet, note that a `/db-migration` should be run first.

Ask the user: what is the resource name, what Supabase table name should be used, and which CRUD operations are needed?
