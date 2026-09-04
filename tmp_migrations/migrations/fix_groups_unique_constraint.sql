-- Replace the global display_name unique constraint with a per-tenant one.
-- This allows different tenants to have groups with the same name.

ALTER TABLE scim_groups
  DROP CONSTRAINT IF EXISTS scim_groups_display_name_key;

ALTER TABLE scim_groups
  ADD CONSTRAINT scim_groups_tenant_display_name_key
  UNIQUE ("tenantId", display_name);
