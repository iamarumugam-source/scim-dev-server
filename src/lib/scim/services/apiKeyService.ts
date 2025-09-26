import { supabase } from "../db";
import { v4 as uuidv4 } from "uuid";

const TABLE_NAME = "api_keys";
const API_KEY_PREFIX = "scim_";

async function hashApiKey(apiKey: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(apiKey);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export class ApiKeyService {
  public async generateKey(
    name: string,
    userId: string
  ): Promise<{ rawKey: string; id: string }> {
    if (!name) throw new Error("API key name is required.");

    const rawKey = `${API_KEY_PREFIX}${uuidv4().replace(/-/g, "")}`;
    const hashedKey = await hashApiKey(rawKey);
    const keyPrefix = rawKey.substring(0, 8);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .insert({
        name,
        hashed_key: hashedKey,
        key_prefix: keyPrefix,
        tenantId: userId,
      })
      .select("id")
      .single();

    if (error) {
      throw new Error(`Supabase error creating API key: ${error.message}`);
    }

    return { rawKey, id: data.id };
  }

  public async validateKey(rawKey: string): Promise<boolean> {
    if (!rawKey) return false;

    const hashedKey = await hashApiKey(rawKey);

    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("id")
      .eq("hashed_key", hashedKey)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows found
      console.error("Error validating API key:", error);
      return false;
    }

    return !!data;
  }

  public async getKeys(
    userId: string
  ): Promise<
    { id: string; name: string; key_prefix: string; created_at: string }[]
  > {
    const { data, error } = await supabase
      .from(TABLE_NAME)
      .select("id, name, key_prefix, created_at")
      .eq("tenantId", userId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new Error(`Supabase error fetching API keys: ${error.message}`);
    }
    return data || [];
  }

  public async revokeKey(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE_NAME)
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) {
      throw new Error(`Supabase error revoking API key: ${error.message}`);
    }

    return count !== null && count > 0;
  }
}
