import { LogService as SBImpl, LogEntry as SBLogEntry } from "./supabase/logService";
import { LogService as PGImpl } from "./postgres/logService";

export const LogService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type LogService = InstanceType<typeof LogService>;

export type LogEntry = SBLogEntry;
