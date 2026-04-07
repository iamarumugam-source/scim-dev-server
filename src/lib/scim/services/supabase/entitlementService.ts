import { supabase } from "../../db";
import { ScimEntitlement } from "../../models/scimSchemas";
import { v4 as uuidv4 } from "uuid";

const BASE_URL  = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
const TABLE     = "scim_entitlements";

export class EntitlementService {
  public async createEntitlement(
    data: Partial<ScimEntitlement>,
    userId: string,
  ): Promise<ScimEntitlement> {
    if (!data.displayName?.trim()) throw new Error("displayName is a required field.");
    if (!data.type?.trim())        throw new Error("type is a required field.");

    const { data: existing } = await supabase
      .from(TABLE)
      .select("id")
      .eq("tenantId", userId)
      .eq("display_name", data.displayName.trim())
      .single();

    if (existing) {
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

    const { error } = await supabase.from(TABLE).insert({
      id,
      display_name: entitlement.displayName,
      resource:     entitlement,
      tenantId:     userId,
    });

    if (error) throw new Error(`Supabase error creating entitlement: ${error.message}`);

    return entitlement;
  }

  public async getEntitlements(
    startIndex: number = 1,
    count: number      = 10,
    userId: string,
  ): Promise<{ entitlements: ScimEntitlement[]; total: number }> {
    const { data, error, count: total } = await supabase
      .from(TABLE)
      .select("resource", { count: "exact" })
      .eq("tenantId", userId)
      .range(startIndex - 1, startIndex - 1 + count - 1);

    if (error) throw new Error(`Supabase error getting entitlements: ${error.message}`);

    return {
      entitlements: (data ?? []).map((r) => r.resource as ScimEntitlement),
      total:        total ?? 0,
    };
  }

  public async getEntitlementById(id: string): Promise<ScimEntitlement | undefined> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("resource")
      .eq("id", id)
      .single();

    if (error) {
      if (error.code === "PGRST116") return undefined;
      throw new Error(`Supabase error getting entitlement: ${error.message}`);
    }

    return data ? (data.resource as ScimEntitlement) : undefined;
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

    const { error } = await supabase
      .from(TABLE)
      .update({ display_name: updated.displayName, resource: updated, last_modified_at: now })
      .eq("id", id);

    if (error) throw new Error(`Supabase error updating entitlement: ${error.message}`);

    return updated;
  }

  public async deleteEntitlement(id: string): Promise<boolean> {
    const { error, count } = await supabase
      .from(TABLE)
      .delete({ count: "exact" })
      .eq("id", id);

    if (error) throw new Error(`Supabase error deleting entitlement: ${error.message}`);

    return (count ?? 0) > 0;
  }

  public async deleteAllEntitlements(userId: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("tenantId", userId);
    if (error) throw new Error(`Supabase error deleting entitlements: ${error.message}`);
  }
}
