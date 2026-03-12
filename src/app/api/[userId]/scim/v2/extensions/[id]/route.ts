import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { extensionService } from "@/lib/scim/services/extensionService";

interface RouteParams { params: { userId: string; id: string } }

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  const ext = await extensionService.getExtensionById(id);
  if (!ext || ext.tenantId !== userId)
    return NextResponse.json({ detail: "Not found." }, { status: 404 });

  return NextResponse.json(ext);
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const body    = await request.json();
    const updated = await extensionService.updateExtension(id, userId, {
      schemaUrn: body.schemaUrn,
      fields:    body.fields,
      enabled:   body.enabled,
    });
    if (!updated) return NextResponse.json({ detail: "Not found." }, { status: 404 });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const { userId, id } = await params;
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  try {
    const deleted = await extensionService.deleteExtension(id, userId);
    if (!deleted) return NextResponse.json({ detail: "Not found." }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e: any) {
    return NextResponse.json({ detail: e.message }, { status: 500 });
  }
}
