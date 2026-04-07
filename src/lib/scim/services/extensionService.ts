import {
  ExtensionService as SBImpl,
  ExtensionField as SBExtensionField,
  SchemaExtension as SBSchemaExtension,
} from "./supabase/extensionService";
import {
  ExtensionService as PGImpl,
} from "./postgres/extensionService";

export const ExtensionService =
  process.env.DB_PROVIDER === "postgres" ? PGImpl : SBImpl;
export type ExtensionService = InstanceType<typeof ExtensionService>;

// Re-export shared types (identical between both implementations)
export type ExtensionField   = SBExtensionField;
export type SchemaExtension  = SBSchemaExtension;

export const extensionService = new ExtensionService();
