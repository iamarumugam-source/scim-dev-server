import { GroupService as SBImpl } from "./supabase/groupService";
import { GroupService as PGImpl } from "./postgres/groupService";

export const GroupService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type GroupService = InstanceType<typeof GroupService>;
