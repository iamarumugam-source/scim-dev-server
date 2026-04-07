import { RoleService as SBImpl } from "./supabase/roleService";
import { RoleService as PGImpl } from "./postgres/roleService";

export const RoleService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type RoleService = InstanceType<typeof RoleService>;
