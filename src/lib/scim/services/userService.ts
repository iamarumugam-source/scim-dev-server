import { supabase } from '../db';
import { ScimUser } from '../models/scimSchemas';
import { v4 as uuidv4 } from 'uuid';


const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
const TABLE_NAME = 'scim_users';

export class UserService {
  public async createUser(userData: Partial<ScimUser>, userId: string): Promise<ScimUser> {
    if (!userData.userName) {
      throw new Error('userName is a required field.');
    }

    const { data: existingUser } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('username', userData.userName)
      .single();

    if (existingUser) {
      throw new Error(`User with userName '${userData.userName}' already exists.`);
    }

    const id = uuidv4();
    const now = new Date().toISOString();

    const newUser: ScimUser = {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: id,
      userName: userData.userName,
      name: userData.name || {},
      active: userData.active ?? true,
      emails: userData.emails || [],
      ...userData,
      meta: {
        resourceType: 'User',
        created: now,
        lastModified: now,
        location: `${BASE_URL}/api/scim/v2/Users/${id}`,
        version: `W/"${Date.now()}"`
      },
    };

    const { error } = await supabase.from(TABLE_NAME).insert({
        id: newUser.id,
        username: newUser.userName,
        active: newUser.active,
        resource: newUser,
        tenantId: userId
    });

    if (error) {
        throw new Error(`Supabase error creating user: ${error.message}`);
    }

    return newUser;
  }

  /**
   * Retrieves all users from Supabase with pagination.
   */
  public async getUsers(startIndex: number = 1, count: number = 10, userId: string): Promise<{ users: ScimUser[], total: number }> {
    const { data, error, count: total } = await supabase
        .from(TABLE_NAME)
        .select('resource', { count: 'exact' })
        .eq('tenantId', userId)
        .range(startIndex - 1, startIndex - 1 + count - 1);
    
    if (error) {
      console.log(error)
        throw new Error(`Supabase error getting users: ${error.message}`);
    }

    const users = data.map(item => item.resource as ScimUser);
    return { users, total: total || 0 };
  }

  /**
   * Finds a user by their ID from Supabase.
   */
  public async getUserById(id: string): Promise<ScimUser | null> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('resource')
      .eq('id', id)
      .single();
    
    if (error) {
        // 'single()' throws an error if no rows are found, which is expected.
        if (error.code === 'PGRST116') return null; 
        throw new Error(`Supabase error getting user: ${error.message}`);
    }
    
    return data ? data.resource as ScimUser : null;
  }

  /**
   * Updates a user's information (PUT) in Supabase.
   */
  public async updateUser(id: string, userData: Partial<ScimUser>): Promise<ScimUser | null> {
    const originalUser = await this.getUserById(id);

    if (!originalUser) {
      return null;
    }

    const now = new Date().toISOString();
    const updatedUser: ScimUser = {
      ...originalUser,
      ...userData,
      id: originalUser.id, 
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      meta: {
        ...originalUser.meta,
        lastModified: now,
        version: `W/"${Date.now()}"`
      },
    };
    
    const { error } = await supabase
        .from(TABLE_NAME)
        .update({
            username: updatedUser.userName,
            active: updatedUser.active,
            resource: updatedUser,
            last_modified_at: now
        })
        .eq('id', id);

    if (error) {
        throw new Error(`Supabase error updating user: ${error.message}`);
    }
    
    return updatedUser;
  }

  /**
   * Deletes a user by their ID from Supabase.
   */
  public async deleteUser(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
        throw new Error(`Supabase error deleting user: ${error.message}`);
    }
    
    return count !== null && count > 0;
  }

    public async deleteAllUsers(id: string): Promise<boolean> {
  
      const {error, count} = await supabase.from(TABLE_NAME).delete().neq('id', id)
  
      if(error) {
          throw new Error(`Supabase error deleting group: ${error.message}`);
      }
      return true;
    }
}

