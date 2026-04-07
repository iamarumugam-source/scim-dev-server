import { EntitlementService as SBImpl } from "./supabase/entitlementService";
import { EntitlementService as PGImpl } from "./postgres/entitlementService";

export const EntitlementService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type EntitlementService = InstanceType<typeof EntitlementService>;
