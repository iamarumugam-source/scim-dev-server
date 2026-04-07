import { getPool } from "../../db-postgres";

export interface ResetSelections {
  users?:        boolean;
  groups?:       boolean;
  entitlements?: boolean;
  roles?:        boolean;
  logs?:         boolean;
  pageViews?:    boolean;
}

export class ResourceResetService {
  async reset(userId: string, selections: ResetSelections): Promise<void> {
    const pool     = getPool();
    const resetAll = Object.keys(selections).length === 0;
    const should   = (key: keyof ResetSelections) => resetAll || selections[key] === true;

    if (should("roles")) {
      await pool.query('DELETE FROM scim_roles WHERE "tenantId" = $1', [userId]);
    }
    if (should("entitlements")) {
      await pool.query('DELETE FROM scim_entitlements WHERE "tenantId" = $1', [userId]);
    }
    if (should("groups")) {
      await pool.query('DELETE FROM scim_groups WHERE "tenantId" = $1', [userId]);
    }
    if (should("users")) {
      await pool.query('DELETE FROM scim_users WHERE "tenantId" = $1', [userId]);
    }
    if (should("logs")) {
      await pool.query('DELETE FROM scim_logs WHERE "tenantId" = $1', [userId]);
    }
    if (should("pageViews")) {
      await pool.query('DELETE FROM scim_page_views WHERE "tenantId" = $1', [userId]);
    }
  }
}
