import { NextRequest, NextResponse } from "next/server";
import { GroupService } from "@/lib/scim/services/groupService";
import { logExternalRequest } from "@/lib/scim/logging";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
const groupService = new GroupService();

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
    schemas: ["urn:ietf:params:scim:api:2.0:Error"],
    detail: "Group not found",
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
    const group = await groupService.getGroupById(id);
    if (!group) {
      return notFoundResponse(request, userId);
    }
    return createAndLogResponse(request, group, { status: 200 }, userId);
  } catch (error: any) {
    const errorData = { detail: error.message, status: "500" };
    return createAndLogResponse(request, errorData, { status: 500 }, userId);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorizedResponse = await protectWithApiKey(request);
  if (unauthorizedResponse) {
    const errorData = { detail: "Unauthorized" };
    return createAndLogResponse(request, errorData, { status: 401 }, userId);
  }
  try {
    const body = await request.json();
    const updatedGroup = await groupService.updateGroup(id, body);
    if (!updatedGroup) {
      return notFoundResponse(body, userId);
    }
    return createAndLogResponse(request, updatedGroup, { status: 200 }, userId);
  } catch (error: any) {
    return NextResponse.json(
      {
        schemas: ["urn:ietf:params:scim:api:2.0:Error"],
        detail: error.message,
        status: "400",
      },
      { status: 400 }
    );
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  console.log(request);
  const { userId, id } = params;

  const unauthorizedResponse = await protectWithApiKey(request);
  if (unauthorizedResponse) {
    const errorData = { detail: "Unauthorized" };
    return createAndLogResponse(request, errorData, { status: 401 }, userId);
  }

  try {
    const body = await request.json();

    const patchedGroup = await groupService.patchGroup(id, body);

    if (!patchedGroup) {
      return notFoundResponse(body, userId);
    }

    return createAndLogResponse(body, patchedGroup, { status: 200 }, userId);
  } catch (error: any) {
    return NextResponse.json(
      {
        schemas: ["urn:ietf:params:scim:api:2.0:Error"],
        detail: error.message,
        status: "400",
      },
      { status: 400 }
    );
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
    const success = await groupService.deleteGroup(id);
    if (!success) {
      return notFoundResponse(request, userId);
    }
    return createAndLogResponse(request, null, { status: 200 }, userId);
  } catch (error: any) {
    const errorData = { detail: error.message, status: "500" };
    return createAndLogResponse(request, errorData, { status: 500 }, userId);
  }
}
