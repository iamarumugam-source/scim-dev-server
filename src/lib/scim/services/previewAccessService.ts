import {
  PreviewAccessService as SBImpl,
  type PreviewUser as SBPreviewUser,
} from "./supabase/previewAccessService";
import { PreviewAccessService as PGImpl } from "./postgres/previewAccessService";

export const PreviewAccessService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type PreviewAccessService = InstanceType<typeof PreviewAccessService>;

export type PreviewUser = SBPreviewUser;
