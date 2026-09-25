import { supabase } from "../../db";

const TABLE = "preview_access";

export interface PreviewUser {
  userId:  string;
  label:   string | null;
  addedAt: string;
}

export class PreviewAccessService {
  async list(): Promise<PreviewUser[]> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("user_id, label, added_at")
      .order("added_at", { ascending: true });

    if (error) throw new Error(`Supabase error listing preview access: ${error.message}`);
    return (data ?? []).map((r) => ({
      userId:  r.user_id as string,
      label:   (r.label as string | null) ?? null,
      addedAt: r.added_at as string,
    }));
  }

  /** Empty allowlist = bootstrap: everyone is allowed until the first entry lands. */
  async isEmpty(): Promise<boolean> {
    const { count, error } = await supabase
      .from(TABLE)
      .select("user_id", { count: "exact", head: true });
    if (error) throw new Error(`Supabase error counting preview access: ${error.message}`);
    return (count ?? 0) === 0;
  }

  async isAllowed(userId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from(TABLE)
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(`Supabase error checking preview access: ${error.message}`);
    return Boolean(data);
  }

  async add(userId: string, label: string | null): Promise<void> {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ user_id: userId, label }, { onConflict: "user_id" });
    if (error) throw new Error(`Supabase error granting preview access: ${error.message}`);
  }

  async remove(userId: string): Promise<void> {
    const { error } = await supabase.from(TABLE).delete().eq("user_id", userId);
    if (error) throw new Error(`Supabase error revoking preview access: ${error.message}`);
  }
}
