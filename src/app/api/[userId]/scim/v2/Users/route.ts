import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/lib/scim/services/userService";
import { ScimListResponse, ScimUser } from "@/lib/scim/models/scimSchemas";
import { logExternalRequest } from "@/lib/scim/logging";
import { protectWithApiKey } from "@/lib/scim/apiHelper";

const userService = new UserService();
interface RouteParams {
  params: { userId: string };
}

function createAndLogResponse(
  request: NextRequest,
  data: any,
  options: { status: number },
  userId: string
): NextResponse {
  const response = NextResponse.json(data, options);
  logExternalRequest(request, response, data, userId);
  return response;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const unauthorizedResponse = await protectWithApiKey(request);
  if (unauthorizedResponse) {
    const errorData = { detail: "Unauthorized" };
    return createAndLogResponse(request, errorData, { status: 401 }, userId);
  }

  const { searchParams } = new URL(request.url);
  const startIndex = parseInt(searchParams.get("startIndex") || "1", 10);
  const count = parseInt(searchParams.get("count") || "10", 10);

  const filter = searchParams.get("filter");

  try {
    const { users, total } = await userService.getUsers(
      startIndex,
      count,
      userId,
      filter
    );

    const listResponse: ScimListResponse<ScimUser> = {
      schemas: ["urn:ietf:params:scim:api:2.0:ListResponse"],
      totalResults: total,
      itemsPerPage: users.length,
      startIndex: startIndex,
      Resources: users,
    };
    return createAndLogResponse(request, listResponse, { status: 200 }, userId);
  } catch (error: any) {
    if (error.message.includes("Invalid or unsupported filter")) {
      const errorData = {
        schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
        scimType: "invalidFilter",
        detail: error.message,
        status: "400",
      };
      return createAndLogResponse(request, errorData, { status: 400 }, userId);
    }

    const errorData = { detail: error.message, status: "500" };
    return createAndLogResponse(request, errorData, { status: 500 }, userId);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const unauthorizedResponse = await protectWithApiKey(request);
  if (unauthorizedResponse) {
    const errorData = { detail: "Unauthorized" };
    return createAndLogResponse(request, errorData, { status: 401 }, userId);
  }

  try {
    const body = await request.clone().json();
    const newUser = await userService.createUser(body, userId);
    return createAndLogResponse(request, newUser, { status: 201 }, userId);
  } catch (error: any) {
    if (error.message.includes("already exists")) {
      const errorData = {
        schemas: ["urn:ietf:params:scim:api:2.0:Error"],
        detail: error.message,
        status: "409",
      };
      return createAndLogResponse(request, errorData, { status: 409 }, userId);
    }
    const errorData = {
      schemas: ["urn:ietf:params:scim:api:2.0:Error"],
      detail: error.message,
      status: "400",
    };
    return createAndLogResponse(request, errorData, { status: 400 }, userId);
  }
}
