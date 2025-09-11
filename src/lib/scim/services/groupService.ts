import { supabase } from '../db';
import { ScimGroup } from '../models/scimSchemas';
import { v4 as uuidv4 } from 'uuid';

/**
 * @file Handles the business logic for SCIM Group resources using Supabase.
 */

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const TABLE_NAME = 'scim_groups';

export class GroupService {
  /**
   * Creates a new group in Supabase.
   */
  public async createGroup(groupData: Partial<ScimGroup>): Promise<ScimGroup> {
    if (!groupData.displayName) {
      throw new Error('displayName is a required field.');
    }
    
    const { data: existingGroup } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('display_name', groupData.displayName)
      .single();

    if (existingGroup) {
        throw new Error(`Group with name '${groupData.displayName}' already exists.`);
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const newGroup: ScimGroup = {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
      id: id,
      displayName: groupData.displayName,
      members: groupData.members || [],
      meta: {
        resourceType: 'Group',
        created: now,
        lastModified: now,
        location: `${BASE_URL}/api/scim/v2/Groups/${id}`,
        version: `W/"${Date.now()}"`
      },
    };
    
    const { error } = await supabase.from(TABLE_NAME).insert({
        id: newGroup.id,
        display_name: newGroup.displayName,
        resource: newGroup
    });
    
    if (error) {
        throw new Error(`Supabase error creating group: ${error.message}`);
    }
    
    return newGroup;
  }

  /**
   * Retrieves all groups from Supabase with pagination.
   */
  public async getGroups(startIndex: number = 1, count: number = 10): Promise<{ groups: ScimGroup[], total: number }> {
    const { data, error, count: total } = await supabase
        .from(TABLE_NAME)
        .select('resource', { count: 'exact' })
        .range(startIndex - 1, startIndex - 1 + count - 1);
    
    if (error) {
        throw new Error(`Supabase error getting groups: ${error.message}`);
    }

    const groups = data.map(item => item.resource as ScimGroup);
    return { groups, total: total || 0 };
  }

    /**
   * Finds a group by its ID from Supabase.
   */
  public async getGroupById(id: string): Promise<ScimGroup | undefined> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('resource')
      .eq('id', id)
      .single();
    
    if (error) {
        if (error.code === 'PGRST116') return undefined; 
        throw new Error(`Supabase error getting group: ${error.message}`);
    }
    
    return data ? data.resource as ScimGroup : undefined;
  }

  /**
   * Updates a group (PUT) in Supabase.
   */
  public async updateGroup(id: string, groupData: Partial<ScimGroup>): Promise<ScimGroup | null> {
      const originalGroup = await this.getGroupById(id);

      if (!originalGroup) {
          return null;
      }

      const now = new Date().toISOString();
      const updatedGroup: ScimGroup = {
          ...originalGroup,
          ...groupData,
          id: originalGroup.id,
          schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
          meta: {
              ...originalGroup.meta,
              lastModified: now,
              version: `W/"${Date.now()}"`
          },
      };

      const { error } = await supabase
        .from(TABLE_NAME)
        .update({
            display_name: updatedGroup.displayName,
            resource: updatedGroup,
            last_modified_at: now
        })
        .eq('id', id);
    
    if (error) {
        throw new Error(`Supabase error updating group: ${error.message}`);
    }

    return updatedGroup;
  }

  /**
   * Deletes a group by its ID from Supabase.
   */
  public async deleteGroup(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
        throw new Error(`Supabase error deleting group: ${error.message}`);
    }
    
    return count !== null && count > 0;
  }
}

