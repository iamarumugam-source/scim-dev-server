import { getPool } from "../../db-postgres";
import { ScimRole } from "../../models/scimSchemas";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export class RoleService {
  public async createRole(data: Partial<ScimRole>, userId: string): Promise<ScimRole> {
    if (!data.displayName?.trim()) throw new Error("displayName is a required field.");

    const pool = getPool();

    const existing = await pool.query(
      'SELECT id FROM scim_roles WHERE "tenantId" = $1 AND display_name = $2',
      [userId, data.displayName.trim()],
    );
    if (existing.rows.length > 0) {
      throw new Error(`Role with name '${data.displayName}' already exists.`);
    }

    const id  = uuidv4();
    const now = new Date().toISOString();

    const role: ScimRole = {
      schemas:     ["urn:okta:scim:schemas:core:1.0:Role"],
      id,
      displayName: data.displayName.trim(),
      description: data.description?.trim(),
      meta: {
        resourceType: "Entitlement",
        created:      now,
        lastModified: now,
        location:     `${BASE_URL}/api/${userId}/scim/v2/Roles/${id}`,
        version:      `W/"${Date.now()}"`,
      },
    };

    await pool.query(
      `INSERT INTO scim_roles (id, display_name, resource, "tenantId") VALUES ($1, $2, $3, $4)`,
      [id, role.displayName, role, userId],
    );

    return role;
  }

  public async getRoles(
    startIndex: number = 1,
    count: number = 10,
    userId: string,
  ): Promise<{ roles: ScimRole[]; total: number }> {
    const pool   = getPool();
    const offset = startIndex - 1;

    const result = await pool.query(
      `SELECT resource, COUNT(*) OVER()::int AS total_count
       FROM scim_roles
       WHERE "tenantId" = $1
       ORDER BY created_at
       OFFSET $2 LIMIT $3`,
      [userId, offset, count],
    );

    const total = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const roles = result.rows.map((r: any) => r.resource as ScimRole);
    return { roles, total };
  }

  public async getRoleById(id: string): Promise<ScimRole | undefined> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT resource FROM scim_roles WHERE id = $1',
        [id],
      );
      if (result.rows.length === 0) return undefined;
      return result.rows[0].resource as ScimRole;
    } catch (err: any) {
      if (err.code === "22P02") return undefined;
      throw err;
    }
  }

  public async updateRole(id: string, data: Partial<ScimRole>): Promise<ScimRole | null> {
    const original = await this.getRoleById(id);
    if (!original) return null;

    const now = new Date().toISOString();
    const updated: ScimRole = {
      ...original,
      displayName: data.displayName?.trim() ?? original.displayName,
      description: data.description !== undefined ? data.description?.trim() : original.description,
      meta: { ...original.meta, lastModified: now, version: `W/"${Date.now()}"` },
    };

    const pool = getPool();
    await pool.query(
      `UPDATE scim_roles SET display_name = $1, resource = $2, last_modified_at = $3 WHERE id = $4`,
      [updated.displayName, updated, now, id],
    );

    return updated;
  }

  public async deleteRole(id: string): Promise<boolean> {
    const pool   = getPool();
    const result = await pool.query(
      'DELETE FROM scim_roles WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  public async deleteAllRoles(userId: string): Promise<void> {
    const pool = getPool();
    await pool.query('DELETE FROM scim_roles WHERE "tenantId" = $1', [userId]);
  }
}
