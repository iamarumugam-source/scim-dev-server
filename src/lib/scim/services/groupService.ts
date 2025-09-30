import { supabase } from "../db";
import { ScimGroup } from "../models/scimSchemas";
import { v4 as uuidv4 } from "uuid";

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const TABLE_NAME = "scim_groups";

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
    userId: string
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
        `Group with name '${groupData.displayName}' already exists.`
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
        location: `${BASE_URL}/api/scim/v2/Groups/${id}`,
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
    userId: string
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

    const groups = data.map((item) => item.resource as ScimGroup);
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

    return data ? (data.resource as ScimGroup) : undefined;
  }

  public async updateGroup(
    id: string,
    groupData: Partial<ScimGroup>
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

  public async patchGroup(
    id: string,
    patchData: ScimPatchOp
  ): Promise<ScimGroup | null> {
    // Step 1: Fetch the original group
    const originalGroup = await this.getGroupById(id);

    if (!originalGroup) {
      return null; // Group not found
    }

    // Create a mutable copy to apply changes to
    const groupToUpdate: ScimGroup = JSON.parse(JSON.stringify(originalGroup));

    // Step 2: Process each operation from the request
    for (const op of patchData.Operations) {
      switch (op.op.toLowerCase()) {
        case "replace":
          if (op.path === "members") {
            groupToUpdate.members = op.value || [];
          } else if (op.path === "displayName") {
            groupToUpdate.displayName = op.value;
          }
          // Add other 'replace' paths here if needed
          break;

        case "add":
          if (op.path === "members") {
            groupToUpdate.members = groupToUpdate.members || [];
            const newMembers = Array.isArray(op.value) ? op.value : [op.value];

            // Add only members that don't already exist
            const existingMemberIds = new Set(
              groupToUpdate.members.map((m) => m.value)
            );
            newMembers.forEach((newMember: any) => {
              if (newMember.value && !existingMemberIds.has(newMember.value)) {
                groupToUpdate.members.push(newMember);
              }
            });
          }
          // Add other 'add' paths here if needed
          break;

        case "remove":
          // A simple 'remove' might target a specific member via a filter in the path
          // e.g., path: 'members[value eq "23a35c27..."]'
          const memberFilterMatch = op.path.match(
            /members\[value eq "(.+?)"\]/
          );
          if (memberFilterMatch) {
            const memberIdToRemove = memberFilterMatch[1];
            groupToUpdate.members = (groupToUpdate.members || []).filter(
              (member) => member.value !== memberIdToRemove
            );
          }
          break;

        default:
          // Optional: Throw an error for unsupported operations
          console.warn(`Unsupported PATCH operation: ${op.op}`);
          break;
      }
    }

    // Step 3: Update metadata and save to the database
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
        resource: groupToUpdate, // Save the entire updated object
        last_modified_at: now,
      })
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase error patching group: ${error.message}`);
    }

    // Step 4: Return the fully updated group
    return groupToUpdate;
  }
}
