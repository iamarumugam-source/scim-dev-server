import { SettingsService as SBImpl, TenantSettings as SBTenantSettings } from "./supabase/settingsService";
import { SettingsService as PGImpl } from "./postgres/settingsService";

export const SettingsService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type SettingsService = InstanceType<typeof SettingsService>;

export type TenantSettings = SBTenantSettings;
