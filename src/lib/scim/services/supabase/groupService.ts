import { supabase } from "../../db";
import { ScimGroup } from "../../models/scimSchemas";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const TABLE_NAME = "scim_groups";

/** Replace the origin of a stored URL with the current public BASE_URL. */
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

    const { data: existingGroup } = await supabase
      .from(TABLE_NAME)
      .select("id")
      .eq("display_name", groupData.displayName)
      .single();

    if (existingGroup) {
      throw new Error(
        `Group with name '${groupData.displayName}' already exists.`,
      );
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const newGroup: ScimGroup = {
      schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
      id: id,
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

    const { error } = await supabase.from(TABLE_NAME).insert({
      id: newGroup.id,
      display_name: newGroup.displayName,
      resource: newGroup,
      tenantId: userId,
    });

    if (error) {
      throw new Error(`Supabase error creating group: ${error.message}`);
    }

    return newGroup;
  }

  public async getGroups(
    startIndex: number = 1,
    count: number = 10,
    userId: string,
  ): Promise<{ groups: ScimGroup[]; total: number }> {
    const {
      data,
      error,
      count: total,
    } = await supabase
      .from(TABLE_NAME)
      .select("resource", { count: "exact" })
      .eq("tenantId", userId)
      .range(startIndex - 1, startIndex - 1 + count - 1);

    if (error) {
      throw new Error(`Supabase error getting groups: ${error.message}`);
    }

    const groups = data.map((item) => normalizeGroup(item.resource as ScimGroup));
    return { groups, total: total || 0 };
  }

  public async getGroupById(id: string): Promise<ScimGroup | undefined> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("resource")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return undefined;
      throw new Error(`Supabase error getting group: ${error.message}`);
    }

    return data ? normalizeGroup(data.resource as ScimGroup) : undefined;
  }

  public async updateGroup(
    id: string,
    groupData: Partial<ScimGroup>,
  ): Promise<ScimGroup | null> {
    const originalGroup = await this.getGroupById(id);

    if (!originalGroup) {
      return null;
    }

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

    const { error } = await supabase
      .from(TABLE_NAME)
      .update({
        display_name: updatedGroup.displayName,
        resource: updatedGroup,
        last_modified_at: now,
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase error updating group: ${error.message}`);
    }

    const originalIds = new Set((originalGroup.members ?? []).map((m) => m.value));
    const updatedIds  = new Set((updatedGroup.members ?? []).map((m) => m.value));
    const addedIds    = [...updatedIds].filter((uid) => !originalIds.has(uid));
    const removedIds  = [...originalIds].filter((uid) => !updatedIds.has(uid));
    await this.syncUserGroupMemberships(updatedGroup, addedIds, removedIds);

    return updatedGroup;
  }

  public async deleteGroup(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase error deleting group: ${error.message}`);
    }

    return count !== null && count > 0;
  }

  public async deleteAllGroups(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .delete()
      .neq("id", id);

    if (error) {
      throw new Error(`Supabase error deleting group: ${error.message}`);
    }
    return true;
  }

  private async syncUserGroupMemberships(
    group: ScimGroup,
    addedUserIds: string[],
    removedUserIds: string[],
  ): Promise<void> {
    if (addedUserIds.length === 0 && removedUserIds.length === 0) return;

    const groupEntry = {
      value: group.id,
      display: group.displayName,
      $ref: rewriteOrigin(group.meta?.location || `${BASE_URL}/api/scim/v2/Groups/${group.id}`),
    };

    if (addedUserIds.length > 0) {
      const { data } = await supabase
        .from("scim_users")
        .select("id, resource")
        .in("id", addedUserIds);

      for (const row of data ?? []) {
        const user = row.resource as any;
        const groups: any[] = user.groups ?? [];
        if (groups.some((g: any) => g.value === group.id)) continue;
        const now = new Date().toISOString();
        await supabase.from("scim_users").update({
          resource: {
            ...user,
            groups: [...groups, groupEntry],
            meta: { ...user.meta, lastModified: now, version: `W/"${Date.now()}"` },
          },
        }).eq("id", row.id);
      }
    }

    if (removedUserIds.length > 0) {
      const { data } = await supabase
        .from("scim_users")
        .select("id, resource")
        .in("id", removedUserIds);

      for (const row of data ?? []) {
        const user = row.resource as any;
        const groups = (user.groups ?? []).filter((g: any) => g.value !== group.id);
        const now = new Date().toISOString();
        await supabase.from("scim_users").update({
          resource: {
            ...user,
            groups,
            meta: { ...user.meta, lastModified: now, version: `W/"${Date.now()}"` },
          },
        }).eq("id", row.id);
      }
    }
  }

  public async patchGroup(
    id: string,
    patchData: ScimPatchOp,
  ): Promise<ScimGroup | null> {
    const originalGroup = await this.getGroupById(id);

    if (!originalGroup) {
      return null;
    }

    const groupToUpdate: ScimGroup = JSON.parse(JSON.stringify(originalGroup));
    const addedMemberIds:   string[] = [];
    const removedMemberIds: string[] = [];

    for (const op of patchData.Operations) {
      switch (op.op.toLowerCase()) {
        case "replace":
          if (!op.path && typeof op.value === "object") {
            if (op.value.displayName) {
              groupToUpdate.displayName = op.value.displayName;
            }
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
            const newMembers = Array.isArray(op.value) ? op.value : [op.value];
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

    const { error } = await supabase
      .from(TABLE_NAME)
      .update({
        display_name: groupToUpdate.displayName,
        resource: groupToUpdate,
        last_modified_at: now,
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase error patching group: ${error.message}`);
    }

    await this.syncUserGroupMemberships(groupToUpdate, addedMemberIds, removedMemberIds);

    return groupToUpdate;
  }
}
