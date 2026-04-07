import { ApiKeyService as SBImpl } from "./supabase/apiKeyService";
import { ApiKeyService as PGImpl } from "./postgres/apiKeyService";

export const ApiKeyService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type ApiKeyService = InstanceType<typeof ApiKeyService>;
