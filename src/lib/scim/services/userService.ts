import { UserService as SBImpl } from "./supabase/userService";
import { UserService as PGImpl } from "./postgres/userService";

export const UserService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type UserService = InstanceType<typeof UserService>;
