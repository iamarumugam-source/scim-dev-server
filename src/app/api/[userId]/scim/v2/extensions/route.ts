import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { extensionService } from "@/lib/scim/services/extensionService";
import { logExternalRequest } from "@/lib/scim/logging";

interface RouteParams { params: { userId: string } }

function createAndLogResponse(
  request: NextRequest, data: any, options: { status: number }, userId: string,
): NextResponse {
  const response = NextResponse.json(data, options);
  logExternalRequest(request, response, data, userId);
  return response;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const extensions = await extensionService.getExtensions(userId);
    return createAndLogResponse(request, extensions, { status: 200 }, userId);
  } catch (e: any) {
    return createAndLogResponse(request, { detail: e.message }, { status: 500 }, userId);
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.clone().json();
    if (!body.schemaUrn?.trim()) {
      return createAndLogResponse(request, { detail: "schemaUrn is required." }, { status: 400 }, userId);
    }
    const ext = await extensionService.createExtension(
      userId,
      body.schemaUrn.trim(),
      body.fields  ?? [],
      body.enabled ?? true,
    );
    return createAndLogResponse(request, ext, { status: 201 }, userId);
  } catch (e: any) {
    return createAndLogResponse(request, { detail: e.message }, { status: 500 }, userId);
  }
}
