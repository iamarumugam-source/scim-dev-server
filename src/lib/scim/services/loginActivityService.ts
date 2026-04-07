import { LoginActivityService as SBImpl } from "./supabase/loginActivityService";
import { LoginActivityService as PGImpl } from "./postgres/loginActivityService";

export const LoginActivityService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type LoginActivityService = InstanceType<typeof LoginActivityService>;
