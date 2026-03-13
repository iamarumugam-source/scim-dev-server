import { NextRequest, NextResponse } from "next/server";
import { RoleService } from "@/lib/scim/services/roleService";
import { logExternalRequest } from "@/lib/scim/logging";
import { protectWithApiKey } from "@/lib/scim/apiHelper";

const roleService = new RoleService();

interface RouteParams { params: { userId: string; id: string } }

function createAndLogResponse(
  request: NextRequest, data: any, options: { status: number }, userId: string,
): NextResponse {
  const response = NextResponse.json(data, options);
  logExternalRequest(request, response, data, userId);
  return response;
}

const notFound = (request: NextRequest, userId: string) =>
  createAndLogResponse(
    request,
    { schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: "Role not found", status: "404" },
    { status: 404 }, userId,
  );

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) {
    return createAndLogResponse(
      request,
      { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Unauthorized", status: "401" },
      { status: 401 }, userId,
    );
  }
  try {
    const role = await roleService.getRoleById(id);
    if (!role) return notFound(request, userId);
    return createAndLogResponse(request, role, { status: 200 }, userId);
  } catch (error: any) {
    return createAndLogResponse(request, { detail: error.message, status: "500" }, { status: 500 }, userId);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorized = await protectWithApiKey(request.clone() as NextRequest);
  if (unauthorized) {
    return createAndLogResponse(
      request,
      { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Unauthorized", status: "401" },
      { status: 401 }, userId,
    );
  }
  try {
    const body    = await request.clone().json();
    const updated = await roleService.updateRole(id, body);
    if (!updated) return notFound(request, userId);
    return createAndLogResponse(request, updated, { status: 200 }, userId);
  } catch (error: any) {
    return createAndLogResponse(
      request,
      { schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "400" },
      { status: 400 }, userId,
    );
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) {
    return createAndLogResponse(
      request,
      { schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"], detail: "Unauthorized", status: "401" },
      { status: 401 }, userId,
    );
  }
  try {
    const deleted = await roleService.deleteRole(id);
    if (!deleted) return notFound(request, userId);
    return createAndLogResponse(request, null, { status: 204 }, userId);
  } catch (error: any) {
    return createAndLogResponse(request, { detail: error.message, status: "500" }, { status: 500 }, userId);
  }
}
