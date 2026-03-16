import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { extensionService } from "@/lib/scim/services/extensionService";
import { logExternalRequest } from "@/lib/scim/logging";

interface RouteParams { params: { userId: string; id: string } }

function createAndLogResponse(
  request: NextRequest, data: any, options: { status: number }, userId: string,
): NextResponse {
  const response = NextResponse.json(data, options);
  logExternalRequest(request, response, data, userId);
  return response;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  const ext = await extensionService.getExtensionById(id);
  if (!ext || ext.tenantId !== userId)
    return createAndLogResponse(request, { detail: "Not found." }, { status: 404 }, userId);

  return createAndLogResponse(request, ext, { status: 200 }, userId);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body    = await request.clone().json();
    const updated = await extensionService.updateExtension(id, userId, {
      schemaUrn: body.schemaUrn,
      fields:    body.fields,
      enabled:   body.enabled,
    });
    if (!updated) return createAndLogResponse(request, { detail: "Not found." }, { status: 404 }, userId);
    return createAndLogResponse(request, updated, { status: 200 }, userId);
  } catch (e: any) {
    return createAndLogResponse(request, { detail: e.message }, { status: 500 }, userId);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const deleted = await extensionService.deleteExtension(id, userId);
    if (!deleted) return createAndLogResponse(request, { detail: "Not found." }, { status: 404 }, userId);
    return createAndLogResponse(request, null, { status: 204 }, userId);
  } catch (e: any) {
    return createAndLogResponse(request, { detail: e.message }, { status: 500 }, userId);
  }
}
