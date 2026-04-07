import { GenerateService as SBImpl } from "./supabase/generateService";
import { GenerateService as PGImpl } from "./postgres/generateService";

export const GenerateService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type GenerateService = InstanceType<typeof GenerateService>;
