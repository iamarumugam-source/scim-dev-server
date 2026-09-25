import {
  DownstreamOidcService as SBImpl,
  type DownstreamOidcConfig as SBConfig,
  type DownstreamOidcConfigWithSecret as SBConfigWithSecret,
  type LoginAttempt as SBLoginAttempt,
  type LoginAttemptInput as SBLoginAttemptInput,
} from "./supabase/downstreamOidcService";
import { DownstreamOidcService as PGImpl } from "./postgres/downstreamOidcService";

export const DownstreamOidcService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type DownstreamOidcService = InstanceType<typeof DownstreamOidcService>;

export type DownstreamOidcConfig           = SBConfig;
export type DownstreamOidcConfigWithSecret = SBConfigWithSecret;
export type LoginAttempt                   = SBLoginAttempt;
export type LoginAttemptInput              = SBLoginAttemptInput;
