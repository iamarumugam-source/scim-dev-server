import { ResourceResetService as SBImpl, ResetSelections as SBResetSelections } from "./supabase/resourceResetService";
import { ResourceResetService as PGImpl } from "./postgres/resourceResetService";

export const ResourceResetService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type ResourceResetService = InstanceType<typeof ResourceResetService>;

export type ResetSelections = SBResetSelections;
