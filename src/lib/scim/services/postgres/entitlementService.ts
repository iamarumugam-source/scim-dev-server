import { getPool } from "../../db-postgres";
import { ScimEntitlement } from "../../models/scimSchemas";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

export class EntitlementService {
  public async createEntitlement(
    data: Partial<ScimEntitlement>,
    userId: string,
  ): Promise<ScimEntitlement> {
    if (!data.displayName?.trim()) throw new Error("displayName is a required field.");
    if (!data.type?.trim())        throw new Error("type is a required field.");

    const pool = getPool();

    const existing = await pool.query(
      'SELECT id FROM scim_entitlements WHERE "tenantId" = $1 AND display_name = $2',
      [userId, data.displayName.trim()],
    );
    if (existing.rows.length > 0) {
      throw new Error(`Entitlement with name '${data.displayName}' already exists.`);
    }

    const id  = uuidv4();
    const now = new Date().toISOString();

    const entitlement: ScimEntitlement = {
      schemas:     ["urn:okta:scim:schemas:core:1.0:Entitlement"],
      id,
      displayName: data.displayName.trim(),
      type:        data.type.trim(),
      description: data.description?.trim(),
      meta: {
        resourceType: "Entitlement",
        created:      now,
        lastModified: now,
        location:     `${BASE_URL}/api/${userId}/scim/v2/Entitlements/${id}`,
        version:      `W/"${Date.now()}"`,
      },
    };

    await pool.query(
      `INSERT INTO scim_entitlements (id, display_name, resource, "tenantId") VALUES ($1, $2, $3, $4)`,
      [id, entitlement.displayName, entitlement, userId],
    );

    return entitlement;
  }

  public async getEntitlements(
    startIndex: number = 1,
    count: number      = 10,
    userId: string,
  ): Promise<{ entitlements: ScimEntitlement[]; total: number }> {
    const pool   = getPool();
    const offset = startIndex - 1;

    const result = await pool.query(
      `SELECT resource, COUNT(*) OVER()::int AS total_count
       FROM scim_entitlements
       WHERE "tenantId" = $1
       ORDER BY created_at
       OFFSET $2 LIMIT $3`,
      [userId, offset, count],
    );

    const total        = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const entitlements = result.rows.map((r: any) => r.resource as ScimEntitlement);
    return { entitlements, total };
  }

  public async getEntitlementById(id: string): Promise<ScimEntitlement | undefined> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT resource FROM scim_entitlements WHERE id = $1',
        [id],
      );
      if (result.rows.length === 0) return undefined;
      return result.rows[0].resource as ScimEntitlement;
    } catch (err: any) {
      if (err.code === "22P02") return undefined;
      throw err;
    }
  }

  public async updateEntitlement(
    id: string,
    data: Partial<ScimEntitlement>,
  ): Promise<ScimEntitlement | null> {
    const original = await this.getEntitlementById(id);
    if (!original) return null;

    const now = new Date().toISOString();
    const updated: ScimEntitlement = {
      ...original,
      displayName: data.displayName?.trim() ?? original.displayName,
      type:        data.type?.trim()        ?? original.type,
      description: data.description !== undefined ? data.description?.trim() : original.description,
      meta: {
        ...original.meta,
        lastModified: now,
        version:      `W/"${Date.now()}"`,
      },
    };

    const pool = getPool();
    await pool.query(
      `UPDATE scim_entitlements SET display_name = $1, resource = $2, last_modified_at = $3 WHERE id = $4`,
      [updated.displayName, updated, now, id],
    );

    return updated;
  }

  public async deleteEntitlement(id: string): Promise<boolean> {
    const pool   = getPool();
    const result = await pool.query(
      'DELETE FROM scim_entitlements WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  public async deleteAllEntitlements(userId: string): Promise<void> {
    const pool = getPool();
    await pool.query('DELETE FROM scim_entitlements WHERE "tenantId" = $1', [userId]);
  }
}
