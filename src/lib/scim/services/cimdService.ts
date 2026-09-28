import {
  CimdService as SBImpl,
  type CimdConfig as SBCimdConfig,
  type CimdFetch as SBCimdFetch,
} from "./supabase/cimdService";
import { CimdService as PGImpl } from "./postgres/cimdService";

export const CimdService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type CimdService = InstanceType<typeof CimdService>;

export type CimdConfig = SBCimdConfig;
export type CimdFetch  = SBCimdFetch;
