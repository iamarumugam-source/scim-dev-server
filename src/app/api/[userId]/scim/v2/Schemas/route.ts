import { NextRequest, NextResponse } from "next/server";
import { logExternalRequest } from "@/lib/scim/logging";

interface RouteParams {
  params: { userId: string };
}

function createAndLogResponse(
  request: NextRequest, data: any, options: { status: number }, userId: string,
): NextResponse {
  const response = NextResponse.json(data, options);
  logExternalRequest(request, response, data, userId);
  return response;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const schemas = [
    {
      id:          "urn:ietf:params:scim:schemas:core:2.0:User",
      name:        "User",
      description: "User account",
      attributes: [
        { name: "userName",     type: "string",  multiValued: false, required: true,  mutability: "readWrite" },
        { name: "name",         type: "complex", multiValued: false, required: false, mutability: "readWrite" },
        { name: "displayName",  type: "string",  multiValued: false, required: false, mutability: "readWrite" },
        { name: "title",        type: "string",  multiValued: false, required: false, mutability: "readWrite" },
        { name: "userType",     type: "string",  multiValued: false, required: false, mutability: "readWrite" },
        { name: "active",       type: "boolean", multiValued: false, required: false, mutability: "readWrite" },
        { name: "emails",       type: "complex", multiValued: true,  required: false, mutability: "readWrite" },
        { name: "groups",       type: "complex", multiValued: true,  required: false, mutability: "readOnly"  },
        { name: "entitlements", type: "complex", multiValued: true,  required: false, mutability: "readWrite" },
      ],
      meta: { resourceType: "Schema", location: "/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:User" },
    },
    {
      id:          "urn:ietf:params:scim:schemas:core:2.0:Group",
      name:        "Group",
      description: "Group of users",
      attributes: [
        { name: "displayName", type: "string",  multiValued: false, required: true,  mutability: "readWrite" },
        { name: "members",     type: "complex", multiValued: true,  required: false, mutability: "readWrite" },
      ],
      meta: { resourceType: "Schema", location: "/scim/v2/Schemas/urn:ietf:params:scim:schemas:core:2.0:Group" },
    },
    {
      id:          "urn:okta:scim:schemas:core:1.0:Entitlement",
      name:        "Entitlement",
      description: "Entitlement resource that can be assigned to users",
      attributes: [
        { name: "displayName", type: "string", multiValued: false, required: true,  mutability: "readWrite" },
        { name: "type",        type: "string", multiValued: false, required: true,  mutability: "readWrite" },
        { name: "description", type: "string", multiValued: false, required: false, mutability: "readWrite" },
      ],
      meta: { resourceType: "Schema", location: "/scim/v2/Schemas/urn:okta:scim:schemas:core:1.0:Entitlement" },
    },
    {
      id:          "urn:okta:scim:schemas:core:1.0:Role",
      name:        "Role",
      description: "Role resource that can be assigned to users",
      attributes: [
        { name: "displayName", type: "string", multiValued: false, required: true,  mutability: "readWrite" },
        { name: "description", type: "string", multiValued: false, required: false, mutability: "readWrite" },
      ],
      meta: { resourceType: "Schema", location: "/scim/v2/Schemas/urn:okta:scim:schemas:core:1.0:Role" },
    },
  ];

  const data = {
    schemas:      ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: schemas.length,
    itemsPerPage: schemas.length,
    startIndex:   1,
    Resources:    schemas,
  };

  return createAndLogResponse(request, data, { status: 200 }, userId);
}
