import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { CimdService } from "@/lib/scim/services/cimdService";

interface RouteParams { params: Promise<{ userId: string }> }

async function requireTenant(userId: string): Promise<boolean> {
  const session = await getServerSession(authOptions);
  return Boolean(session?.user && (session.user as { id?: string }).id === userId);
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  if (!(await requireTenant(userId)))
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const svc    = new CimdService();
  const config = await svc.getConfig(userId);

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return NextResponse.json({
    config,
    clientIdUrl: `${base}/api/${userId}/cimd/client`,
  });
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  if (!(await requireTenant(userId)))
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ detail: "Invalid JSON." }, { status: 400 }); }

  const svc = new CimdService();
  try {
    const saved = await svc.saveConfig(userId, {
      clientName:  typeof body.clientName  === "string" ? body.clientName  : undefined,
      redirectUris: Array.isArray(body.redirectUris) ? body.redirectUris : undefined,
      scopes:      typeof body.scopes      === "string" ? body.scopes      : undefined,
      authMethod:  typeof body.authMethod  === "string" ? body.authMethod  : undefined,
      jwks:        body.jwks ?? undefined,
      clientUri:   typeof body.clientUri   === "string" ? body.clientUri   : undefined,
    });
    return NextResponse.json({ config: saved });
  } catch (err) {
    return NextResponse.json({ detail: (err as Error).message }, { status: 500 });
  }
}
