import { NextRequest, NextResponse } from "next/server";
import { UserService } from "@/lib/scim/services/userService";
import { logExternalRequest } from "@/lib/scim/logging";
import { protectWithApiKey } from "@/lib/scim/apiHelper";

const userService = new UserService();

interface RouteParams {
  params: { id: string; userId: string };
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

const notFoundResponse = (
  request: NextRequest,
  userId: string
): NextResponse => {
  const errorData = {
    schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
    detail: "User not found",
    status: "404",
  };

  return createAndLogResponse(request, errorData, { status: 404 }, userId);
};

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorizedResponse = await protectWithApiKey(request);
  if (unauthorizedResponse) {
    const errorData = { detail: "Unauthorized" };
    return createAndLogResponse(request, errorData, { status: 401 }, userId);
  }

  try {
    const user = await userService.getUserById(id);
    if (!user) {
      return notFoundResponse(request, userId);
    }
    return createAndLogResponse(request, user, { status: 200 }, userId);
  } catch (error: any) {
    const errorData = { detail: error.message, status: "500" };
    return createAndLogResponse(request, errorData, { status: 500 }, userId);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const unauthorizedResponse = await protectWithApiKey(request);
  const { userId, id } = await params;
  if (unauthorizedResponse) {
    const errorData = { detail: "Unauthorized" };
    return createAndLogResponse(request, errorData, { status: 401 }, userId);
  }

  try {
    const body = await request.json();
    const updatedUser = await userService.updateUser(id, body);
    if (!updatedUser) {
      return notFoundResponse(body, userId);
    }

    return createAndLogResponse(body, updatedUser, { status: 200 }, userId);
  } catch (error: any) {
    const err = {
      schemas: ["urn:ietf:params:scim:api:2.0:Error"],
      detail: error.message,
      status: "400",
    };

    return createAndLogResponse(request, err, { status: 400 }, userId);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorizedResponse = await protectWithApiKey(request);
  if (unauthorizedResponse) {
    const errorData = { detail: "Unauthorized" };
    return createAndLogResponse(request, errorData, { status: 401 }, userId);
  }

  try {
    const success = await userService.deleteUser(id);
    if (!success) {
      return notFoundResponse(request, userId);
    }

    return createAndLogResponse(request, null, { status: 200 }, userId);
    // return new NextResponse(null, { status: 204 });
  } catch (error: any) {
    const errorData = { detail: error.message, status: "500" };
    return createAndLogResponse(request, errorData, { status: 500 }, userId);
  }
}
