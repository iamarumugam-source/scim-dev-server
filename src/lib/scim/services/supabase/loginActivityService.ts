import { supabase } from "../../db";

export class LoginActivityService {
  async getActivity(
    userId: string,
    since: Date,
  ): Promise<{ timestamps: string[]; total: number }> {
    const [{ data, error }, { count: total }] = await Promise.all([
      supabase
        .from("login_activity")
        .select("logged_at")
        .eq("tenantId", userId)
        .gte("logged_at", since.toISOString())
        .order("logged_at", { ascending: true }),
      supabase
        .from("login_activity")
        .select("id", { count: "exact", head: true })
        .eq("tenantId", userId),
    ]);

    if (error) throw new Error(error.message);

    const timestamps = (data ?? []).map((r) => r.logged_at as string);
    return { timestamps, total: total ?? 0 };
  }

  async recordLogin(userId: string): Promise<void> {
    const { error } = await supabase
      .from("login_activity")
      .insert({ tenantId: userId });

    if (error) throw new Error(error.message);
  }
}
