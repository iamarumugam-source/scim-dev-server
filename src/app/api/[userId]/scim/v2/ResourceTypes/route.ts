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
  const origin = process.env.NEXT_PUBLIC_BASE_URL || new URL(request.url).origin;
  const base   = `${origin}/api/${userId}/scim/v2`;

  const resourceTypes = [
    {
      schemas:    ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
      id:         "User",
      name:       "User",
      endpoint:   "/Users",
      description: "User accounts",
      schema:     "urn:ietf:params:scim:schemas:core:2.0:User",
      schemaExtensions: [],
      meta: { resourceType: "ResourceType", location: `${base}/ResourceTypes/User` },
    },
    {
      schemas:    ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
      id:         "Group",
      name:       "Group",
      endpoint:   "/Groups",
      description: "Groups of users",
      schema:     "urn:ietf:params:scim:schemas:core:2.0:Group",
      schemaExtensions: [],
      meta: { resourceType: "ResourceType", location: `${base}/ResourceTypes/Group` },
    },
    {
      schemas:    ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
      id:         "Entitlement",
      name:       "Entitlement",
      endpoint:   "/Entitlements",
      description: "Entitlements that can be assigned to users",
      schema:     "urn:okta:scim:schemas:core:1.0:Entitlement",
      schemaExtensions: [],
      meta: { resourceType: "ResourceType", location: `${base}/ResourceTypes/Entitlement` },
    },
    {
      schemas:    ["urn:ietf:params:scim:schemas:core:2.0:ResourceType"],
      id:         "Role",
      name:       "Role",
      endpoint:   "/Roles",
      description: "Roles that can be assigned to users",
      schema:     "urn:okta:scim:schemas:core:1.0:Role",
      schemaExtensions: [],
      meta: { resourceType: "ResourceType", location: `${base}/ResourceTypes/Role` },
    },
  ];

  const data = {
    schemas:      ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
    totalResults: resourceTypes.length,
    itemsPerPage: resourceTypes.length,
    startIndex:   1,
    Resources:    resourceTypes,
  };

  return createAndLogResponse(request, data, { status: 200 }, userId);
}
