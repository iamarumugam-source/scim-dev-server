import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { extensionService } from "@/lib/scim/services/extensionService";

interface RouteParams { params: { userId: string } }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const extensions = await extensionService.getExtensions(userId);
    return NextResponse.json(extensions, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body = await request.clone().json();
    if (!body.schemaUrn?.trim()) {
      return NextResponse.json({ detail: "schemaUrn is required." }, { status: 400 });
    }
    const ext = await extensionService.createExtension(
      userId,
      body.schemaUrn.trim(),
      body.fields  ?? [],
      body.enabled ?? true,
    );
    return NextResponse.json(ext, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}
