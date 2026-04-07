import { AnalyticsService as SBImpl } from "./supabase/analyticsService";
import { AnalyticsService as PGImpl } from "./postgres/analyticsService";

export const AnalyticsService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type AnalyticsService = InstanceType<typeof AnalyticsService>;
