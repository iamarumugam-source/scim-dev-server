import { supabase } from "../../db";

export interface TenantSettings {
  rateLimitEnabled: boolean;
  rateLimitMax: number;
}

export class SettingsService {
  async getSettings(userId: string): Promise<TenantSettings> {
    const { data } = await supabase
      .from("tenant_settings")
      .select("rate_limit_enabled, rate_limit_max")
      .eq("tenantId", userId)
      .maybeSingle();

    return {
      rateLimitEnabled: data?.rate_limit_enabled ?? true,
      rateLimitMax:     data?.rate_limit_max     ?? 60,
    };
  }

  async updateSettings(
    userId: string,
    enabled: boolean,
    maxPerMinute: number,
  ): Promise<void> {
    const { error } = await supabase
      .from("tenant_settings")
      .upsert(
        { tenantId: userId, rate_limit_enabled: enabled, rate_limit_max: maxPerMinute },
        { onConflict: "tenantId" },
      );

    if (error) throw new Error(error.message);
  }
}
