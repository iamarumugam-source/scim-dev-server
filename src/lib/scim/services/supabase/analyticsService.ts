import { supabase } from "../../db";

export class AnalyticsService {
  async recordPageView(userId: string, path: string): Promise<void> {
    const { error } = await supabase.rpc("increment_page_view", {
      p_tenant_id: userId,
      p_path:      path,
    });

    if (error) {
      console.warn("[analytics] Could not record page view:", error.message);
    }
  }
}
