import { StatsService as SBImpl, StatsRawData as SBStatsRawData } from "./supabase/statsService";
import { StatsService as PGImpl } from "./postgres/statsService";

export const StatsService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type StatsService = InstanceType<typeof StatsService>;

export type StatsRawData = SBStatsRawData;
