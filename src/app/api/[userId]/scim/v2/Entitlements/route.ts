import { NextRequest, NextResponse } from "next/server";
import { EntitlementService } from "@/lib/scim/services/entitlementService";
import { ScimListResponse, ScimEntitlement } from "@/lib/scim/models/scimSchemas";
import { logExternalRequest } from "@/lib/scim/logging";
import { protectWithApiKey } from "@/lib/scim/apiHelper";

const entitlementService = new EntitlementService();

interface RouteParams {
  params: { userId: string };
}

function createAndLogResponse(
  request: NextRequest,
  data: any,
  options: { status: number },
  userId: string,
): NextResponse {
  const response = NextResponse.json(data, options);
  logExternalRequest(request, response, data, userId);
  return response;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) {
    return createAndLogResponse(
      request,
      { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Unauthorized", status: "401" },
      { status: 401 },
      userId,
    );
  }

  const { searchParams } = new URL(request.url);
  const startIndex = parseInt(searchParams.get("startIndex") || "1", 10);
  const count      = parseInt(searchParams.get("count")      || "10", 10);

  try {
    const { entitlements, total } = await entitlementService.getEntitlements(startIndex, count, userId);
    const listResponse: ScimListResponse<ScimEntitlement> = {
      schemas:      ["urn:ietf:params:scim:api:messages:2.0:ListResponse"],
      totalResults: total,
      itemsPerPage: entitlements.length,
      startIndex,
      Resources:    entitlements,
    };
    return createAndLogResponse(request, listResponse, { status: 200 }, userId);
  } catch (error: any) {
    return createAndLogResponse(request, { detail: error.message, status: "500" }, { status: 500 }, userId);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) {
    return createAndLogResponse(request, { detail: "Unauthorized" }, { status: 401 }, userId);
  }

  try {
    const body = await request.clone().json();
    const created = await entitlementService.createEntitlement(body, userId);
    return createAndLogResponse(request, created, { status: 201 }, userId);
  } catch (error: any) {
    if (error.message.includes("already exists")) {
      return createAndLogResponse(
        request,
        { schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "409" },
        { status: 409 },
        userId,
      );
    }
    return createAndLogResponse(
      request,
      { schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "400" },
      { status: 400 },
      userId,
    );
  }
}
