-- Replace the global username unique constraint with a per-tenant one.
-- This allows different tenants to have users with the same userName, which is
-- what SCIM 2.0 requires: userName is unique within a service provider tenant,
-- not globally. Mirrors fix_groups_unique_constraint.sql, which made the same
-- correction for scim_groups.display_name.

ALTER TABLE scim_users
  DROP CONSTRAINT IF EXISTS scim_users_username_key;

ALTER TABLE scim_users
  ADD CONSTRAINT scim_users_tenant_username_key
  UNIQUE ("tenantId", username);
