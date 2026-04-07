import { getPool } from "../../db-postgres";
import { ScimGroup } from "../../models/scimSchemas";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

function rewriteOrigin(url: string): string {
  if (!url) return url;
  try {
    const u = new URL(url);
    const b = new URL(BASE_URL);
    u.protocol = b.protocol;
    u.hostname = b.hostname;
    u.port     = b.port;
    return u.toString();
  } catch { return url; }
}

function normalizeGroup(group: ScimGroup): ScimGroup {
  return {
    ...group,
    meta:    group.meta    ? { ...group.meta, location: rewriteOrigin(group.meta.location ?? "") } : group.meta,
    members: group.members?.map((m: any) => ({ ...m, $ref: m.$ref ? rewriteOrigin(m.$ref) : m.$ref })),
  };
}

interface PatchOperation {
  op: "add" | "replace" | "remove";
  path: string;
  value?: any;
}

interface ScimPatchOp {
  schemas: ["urn:ietf:params:scim:api:messages:2.0:PatchOp"];
  Operations: PatchOperation[];
}

export class GroupService {
  public async createGroup(
    groupData: Partial<ScimGroup>,
    userId: string,
  ): Promise<ScimGroup> {
    if (!groupData.displayName) {
      throw new Error("displayName is a required field.");
    }

    const pool = getPool();

    const existing = await pool.query(
      'SELECT id FROM scim_groups WHERE display_name = $1 AND "tenantId" = $2',
      [groupData.displayName, userId],
    );
    if (existing.rows.length > 0) {
      throw new Error(`Group with name '${groupData.displayName}' already exists.`);
    }

    const id  = uuidv4();
    const now = new Date().toISOString();

    const newGroup: ScimGroup = {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      id,
      displayName: groupData.displayName,
      members: groupData.members || [],
      meta: {
        resourceType: "Group",
        created: now,
        lastModified: now,
        location: `${BASE_URL}/api/${userId}/scim/v2/Groups/${id}`,
        version: `W/"${Date.now()}"`,
      },
    };

    await pool.query(
      `INSERT INTO scim_groups (id, display_name, resource, "tenantId") VALUES ($1, $2, $3, $4)`,
      [newGroup.id, newGroup.displayName, newGroup, userId],
    );

    return newGroup;
  }

  public async getGroups(
    startIndex: number = 1,
    count: number = 10,
    userId: string,
  ): Promise<{ groups: ScimGroup[]; total: number }> {
    const pool   = getPool();
    const offset = startIndex - 1;

    const result = await pool.query(
      `SELECT resource, COUNT(*) OVER()::int AS total_count
       FROM scim_groups
       WHERE "tenantId" = $1
       ORDER BY created_at
       OFFSET $2 LIMIT $3`,
      [userId, offset, count],
    );

    const total  = result.rows.length > 0 ? result.rows[0].total_count : 0;
    const groups = result.rows.map((r: any) => normalizeGroup(r.resource as ScimGroup));
    return { groups, total };
  }

  public async getGroupById(id: string): Promise<ScimGroup | undefined> {
    const pool = getPool();
    try {
      const result = await pool.query(
        'SELECT resource FROM scim_groups WHERE id = $1',
        [id],
      );
      if (result.rows.length === 0) return undefined;
      return normalizeGroup(result.rows[0].resource as ScimGroup);
    } catch (err: any) {
      if (err.code === "22P02") return undefined;
      throw err;
    }
  }

  public async updateGroup(
    id: string,
    groupData: Partial<ScimGroup>,
  ): Promise<ScimGroup | null> {
    const originalGroup = await this.getGroupById(id);
    if (!originalGroup) return null;

    const now = new Date().toISOString();
    const updatedGroup: ScimGroup = {
      ...originalGroup,
      ...groupData,
      id: originalGroup.id,
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      meta: {
        ...originalGroup.meta,
        lastModified: now,
        version: `W/"${Date.now()}"`,
      },
    };

    const pool = getPool();
    await pool.query(
      `UPDATE scim_groups
       SET display_name = $1, resource = $2, last_modified_at = $3
       WHERE id = $4`,
      [updatedGroup.displayName, updatedGroup, now, id],
    );

    const originalIds = new Set((originalGroup.members ?? []).map((m) => m.value));
    const updatedIds  = new Set((updatedGroup.members ?? []).map((m) => m.value));
    const addedIds    = [...updatedIds].filter((uid) => !originalIds.has(uid));
    const removedIds  = [...originalIds].filter((uid) => !updatedIds.has(uid));
    await this.syncUserGroupMemberships(updatedGroup, addedIds, removedIds);

    return updatedGroup;
  }

  public async deleteGroup(id: string): Promise<boolean> {
    const pool   = getPool();
    const result = await pool.query(
      'DELETE FROM scim_groups WHERE id = $1 RETURNING id',
      [id],
    );
    return result.rowCount !== null && result.rowCount > 0;
  }

  public async deleteAllGroups(id: string): Promise<boolean> {
    const pool = getPool();
    await pool.query('DELETE FROM scim_groups WHERE id::text != $1', [id]);
    return true;
  }

  private async syncUserGroupMemberships(
    group: ScimGroup,
    addedUserIds: string[],
    removedUserIds: string[],
  ): Promise<void> {
    if (addedUserIds.length === 0 && removedUserIds.length === 0) return;

    const pool = getPool();

    const groupEntry = {
      value:   group.id,
      display: group.displayName,
      $ref:    rewriteOrigin(group.meta?.location || `${BASE_URL}/api/scim/v2/Groups/${group.id}`),
    };

    if (addedUserIds.length > 0) {
      const placeholders = addedUserIds.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `SELECT id, resource FROM scim_users WHERE id IN (${placeholders})`,
        addedUserIds,
      );

      for (const row of result.rows) {
        const user   = row.resource as any;
        const groups: any[] = user.groups ?? [];
        if (groups.some((g: any) => g.value === group.id)) continue;
        const now = new Date().toISOString();
        await pool.query(
          `UPDATE scim_users SET resource = $1, last_modified_at = $2 WHERE id = $3`,
          [
            {
              ...user,
              groups: [...groups, groupEntry],
              meta: { ...user.meta, lastModified: now, version: `W/"${Date.now()}"` },
            },
            now,
            row.id,
          ],
        );
      }
    }

    if (removedUserIds.length > 0) {
      const placeholders = removedUserIds.map((_, i) => `$${i + 1}`).join(", ");
      const result = await pool.query(
        `SELECT id, resource FROM scim_users WHERE id IN (${placeholders})`,
        removedUserIds,
      );

      for (const row of result.rows) {
        const user   = row.resource as any;
        const groups = (user.groups ?? []).filter((g: any) => g.value !== group.id);
        const now    = new Date().toISOString();
        await pool.query(
          `UPDATE scim_users SET resource = $1, last_modified_at = $2 WHERE id = $3`,
          [
            {
              ...user,
              groups,
              meta: { ...user.meta, lastModified: now, version: `W/"${Date.now()}"` },
            },
            now,
            row.id,
          ],
        );
      }
    }
  }

  public async patchGroup(
    id: string,
    patchData: ScimPatchOp,
  ): Promise<ScimGroup | null> {
    const originalGroup = await this.getGroupById(id);
    if (!originalGroup) return null;

    const groupToUpdate: ScimGroup = JSON.parse(JSON.stringify(originalGroup));
    const addedMemberIds:   string[] = [];
    const removedMemberIds: string[] = [];

    for (const op of patchData.Operations) {
      switch (op.op.toLowerCase()) {
        case "replace":
          if (!op.path && typeof op.value === "object") {
            if (op.value.displayName) groupToUpdate.displayName = op.value.displayName;
            if (op.value.members) {
              const prevIds = new Set(groupToUpdate.members.map((m) => m.value));
              const nextIds = new Set((op.value.members as any[]).map((m) => m.value));
              addedMemberIds.push(...[...nextIds].filter((uid) => !prevIds.has(uid)));
              removedMemberIds.push(...[...prevIds].filter((uid) => !nextIds.has(uid)));
              groupToUpdate.members = op.value.members;
            }
          } else if (op.path === "displayName") {
            groupToUpdate.displayName = op.value;
          } else if (op.path === "members") {
            const prevIds = new Set(groupToUpdate.members.map((m) => m.value));
            const next: any[] = op.value || [];
            const nextIds = new Set(next.map((m) => m.value));
            addedMemberIds.push(...[...nextIds].filter((uid) => !prevIds.has(uid)));
            removedMemberIds.push(...[...prevIds].filter((uid) => !nextIds.has(uid)));
            groupToUpdate.members = next;
          }
          break;

        case "add":
          if (op.path === "members") {
            groupToUpdate.members = groupToUpdate.members || [];
            const newMembers  = Array.isArray(op.value) ? op.value : [op.value];
            const existingIds = new Set(groupToUpdate.members.map((m) => m.value));
            newMembers.forEach((m: any) => {
              if (m.value && !existingIds.has(m.value)) {
                groupToUpdate.members.push(m);
                addedMemberIds.push(m.value);
              }
            });
          }
          break;

        case "remove": {
          const match = op.path.match(/members\[value eq "(.+?)"\]/);
          if (match) {
            const idToRemove = match[1];
            removedMemberIds.push(idToRemove);
            groupToUpdate.members = (groupToUpdate.members || []).filter(
              (m) => m.value !== idToRemove,
            );
          }
          break;
        }

        default:
          console.warn(`Unsupported PATCH operation: ${op.op}`);
          break;
      }
    }

    const now = new Date().toISOString();
    groupToUpdate.meta = {
      ...groupToUpdate.meta,
      lastModified: now,
      version: `W/"${Date.now()}"`,
    };

    const pool = getPool();
    await pool.query(
      `UPDATE scim_groups
       SET display_name = $1, resource = $2, last_modified_at = $3
       WHERE id = $4`,
      [groupToUpdate.displayName, groupToUpdate, now, id],
    );

    await this.syncUserGroupMemberships(groupToUpdate, addedMemberIds, removedMemberIds);

    return groupToUpdate;
  }
}
