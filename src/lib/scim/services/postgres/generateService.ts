import { getPool } from "../../db-postgres";
import { ScimUser, ScimGroup, ScimEntitlement, ScimRole } from "../../models/scimSchemas";

export class GenerateService {
  async deleteExistingData(userId: string): Promise<void> {
    const pool = getPool();

    await pool.query('DELETE FROM scim_roles WHERE "tenantId" = $1', [userId]);
    await pool.query('DELETE FROM scim_entitlements WHERE "tenantId" = $1', [userId]);
    await pool.query('DELETE FROM scim_groups WHERE "tenantId" = $1', [userId]);
    await pool.query('DELETE FROM scim_users WHERE "tenantId" = $1', [userId]);
  }

  async getExistingUsers(userId: string): Promise<ScimUser[]> {
    const pool   = getPool();
    const result = await pool.query(
      'SELECT resource FROM scim_users WHERE "tenantId" = $1',
      [userId],
    );
    return (result.rows.map((r: any) => r.resource) as ScimUser[]).map((u) => {
      if (!u.groups) u.groups = [];
      return u;
    });
  }

  async getExistingGroupNames(userId: string): Promise<string[]> {
    const pool   = getPool();
    const result = await pool.query(
      'SELECT display_name FROM scim_groups WHERE "tenantId" = $1',
      [userId],
    );
    return result.rows.map((r: any) => r.display_name as string);
  }

  async persistGenerated(
    userId: string,
    users: ScimUser[],
    existingUsers: ScimUser[],
    groups: ScimGroup[],
    entitlements: ScimEntitlement[],
    roles: ScimRole[],
  ): Promise<void> {
    const pool = getPool();

    if (users.length > 0) {
      const values  = users.map((_, i) => `($${i * 5 + 1}, $${i * 5 + 2}, $${i * 5 + 3}, $${i * 5 + 4}, $${i * 5 + 5})`).join(", ");
      const params  = users.flatMap((u) => [u.id, u.userName, u.active, JSON.stringify(u), userId]);
      await pool.query(
        `INSERT INTO scim_users (id, username, active, resource, "tenantId") VALUES ${values}`,
        params,
      );
    }

    if (existingUsers.length > 0) {
      for (const u of existingUsers) {
        await pool.query(
          `INSERT INTO scim_users (id, username, active, resource, "tenantId")
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (id) DO UPDATE
           SET username = $2, active = $3, resource = $4`,
          [u.id, u.userName, u.active, JSON.stringify(u), userId],
        );
      }
    }

    if (groups.length > 0) {
      const values = groups.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(", ");
      const params = groups.flatMap((g) => [g.id, g.displayName, JSON.stringify(g), userId]);
      await pool.query(
        `INSERT INTO scim_groups (id, display_name, resource, "tenantId") VALUES ${values}`,
        params,
      );
    }

    if (entitlements.length > 0) {
      const values = entitlements.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(", ");
      const params = entitlements.flatMap((e) => [e.id, e.displayName, JSON.stringify(e), userId]);
      await pool.query(
        `INSERT INTO scim_entitlements (id, display_name, resource, "tenantId") VALUES ${values}`,
        params,
      );
    }

    if (roles.length > 0) {
      const values = roles.map((_, i) => `($${i * 4 + 1}, $${i * 4 + 2}, $${i * 4 + 3}, $${i * 4 + 4})`).join(", ");
      const params = roles.flatMap((r) => [r.id, r.displayName, JSON.stringify(r), userId]);
      await pool.query(
        `INSERT INTO scim_roles (id, display_name, resource, "tenantId") VALUES ${values}`,
        params,
      );
    }
  }
}
