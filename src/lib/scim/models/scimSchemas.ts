/**
 * @file Defines the core SCIM resource schemas and TypeScript types.
 * @see https://tools.ietf.org/html/rfc7643
 */

// Basic SCIM Attribute Types
interface Meta {
  resourceType: "User" | "Group" | "Entitlement";
  created: string;
  lastModified: string;
  location: string;
  version: string; // ETag
}

interface Name {
  formatted?: string;
  familyName?: string;
  givenName?: string;
  middleName?: string;
  honorificPrefix?: string;
  honorificSuffix?: string;
}

interface Email {
  value: string;
  display?: string;
  type?: "work" | "home" | "other";
  primary: boolean;
}

interface Member {
  value: string;
  $ref?: string;
  display?: string;
  type?: "User" | "Group";
}

export interface ScimGroupMember {
  value: string;
  display: string;
  $ref: string;
}

export interface ScimEntitlementAttribute {
  value: string;
  display?: string;
  type?: string;
}

export interface ScimRoleAttribute {
  value: string;
  display?: string;
  primary?: boolean;
}

export interface ScimUser {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"];
  id: string;
  userName: string;
  name: Name;
  displayName?: string;
  nickName?: string;
  profileUrl?: string;
  title?: string;
  userType?: string;
  preferredLanguage?: string;
  locale?: string;
  timezone?: string;
  active: boolean;
  emails: Email[];
  groups?: ScimGroupMember[];
  entitlements?: ScimEntitlementAttribute[];
  roles?: ScimRoleAttribute[];
  meta: Meta;
}

export interface ScimGroup {
  schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"];
  id: string;
  displayName: string;
  members: Member[];
  meta: Meta;
}

export interface ScimEntitlement {
  schemas: ["urn:okta:scim:schemas:core:1.0:Entitlement"];
  id: string;
  displayName: string;
  type: string;
  description?: string;
  meta: Meta;
}

export interface ScimRole {
  schemas: ["urn:okta:scim:schemas:core:1.0:Role"];
  id: string;
  displayName: string;
  description?: string;
  meta: Meta;
}

export interface ScimListResponse<T> {
  schemas: ["urn:ietf:params:scim:api:messages:2.0:ListResponse"];
  totalResults: number;
  itemsPerPage: number;
  startIndex: number;
  Resources: T[];
}

// SCIM Error Response
export interface ScimError {
  schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"];
  detail: string;
  status: string;
}
