import { supabase } from '../db';
import { v4 as uuidv4 } from 'uuid';

/**
 * @file Handles the business logic for generating, validating, and managing API keys.
 */

const TABLE_NAME = 'api_keys';
const API_KEY_PREFIX = 'scim_';

// Helper function to hash an API key using the Web Crypto API.
// This is a one-way process; we can't un-hash the key.
async function hashApiKey(apiKey: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    // Convert buffer to hex string
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export class ApiKeyService {
  /**
   * Generates a new, unique API key.
   * Stores a hashed version of the key in the database.
   * Returns the raw (un-hashed) key to be displayed to the user ONCE.
   */
  public async generateKey(name: string): Promise<{ rawKey: string, id: string }> {
    if (!name) throw new Error('API key name is required.');

    // Generate a new random key
    const rawKey = `${API_KEY_PREFIX}${uuidv4().replace(/-/g, '')}`;
    const hashedKey = await hashApiKey(rawKey);
    // Store only the first 8 characters as a non-secret prefix for identification
    const keyPrefix = rawKey.substring(0, 8);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        name,
        hashed_key: hashedKey,
        key_prefix: keyPrefix,
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Supabase error creating API key: ${error.message}`);
    }

    // Return the raw key so it can be shown to the user.
    return { rawKey, id: data.id };
  }

  /**
   * Validates a raw API key provided in a request.
   * It hashes the provided key and compares it to the stored hashes.
   */
  public async validateKey(rawKey: string): Promise<boolean> {
    if (!rawKey) return false;

    const hashedKey = await hashApiKey(rawKey);
    
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id')
      .eq('hashed_key', hashedKey)
      .single();
    
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
        console.error("Error validating API key:", error);
        return false;
    }
    
    // If a record with the matching hash is found, the key is valid.
    return !!data;
  }

  /**
   * Retrieves all API keys from the database.
   * Does NOT return the actual key, only safe-to-display information.
   */
  public async getKeys(): Promise<{ id: string, name: string, key_prefix: string, created_at: string }[]> {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select('id, name, key_prefix, created_at')
      .order('created_at', { ascending: false });

    if (error) {
        throw new Error(`Supabase error fetching API keys: ${error.message}`);
    }
    return data || [];
  }

  /**
   * Deletes/revokes an API key by its ID.
   */
  public async revokeKey(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .delete({ count: 'exact' })
      .eq('id', id);

    if (error) {
        throw new Error(`Supabase error revoking API key: ${error.message}`);
    }
    
    return count !== null && count > 0;
  }
}

