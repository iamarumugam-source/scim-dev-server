import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabase } from "@/lib/scim/db";
import { setCachedSettings } from "@/lib/tenant-settings";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

/** GET /api/[userId]/settings — returns rate limit config (no auth required; called by middleware). */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const { data } = await supabase
    .from("tenant_settings")
    .select("rate_limit_enabled, rate_limit_max")
    .eq("tenantId", userId)
    .maybeSingle();

  return NextResponse.json({
    rateLimitEnabled: data?.rate_limit_enabled ?? true,
    rateLimitMax:     data?.rate_limit_max     ?? 60,
  });
}

/** PUT /api/[userId]/settings — updates rate limit config (session required). */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).id !== userId) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const enabled      = Boolean(body.rateLimitEnabled);
  const maxPerMinute = Math.max(1, Math.min(10_000, Number(body.rateLimitMax) || 60));

  const { error } = await supabase
    .from("tenant_settings")
    .upsert(
      { tenantId: userId, rate_limit_enabled: enabled, rate_limit_max: maxPerMinute },
      { onConflict: "tenantId" },
    );

  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }

  // Update Node.js runtime cache immediately so the dashboard reflects the change
  setCachedSettings(userId, { enabled, maxPerMinute });

  return NextResponse.json({ rateLimitEnabled: enabled, rateLimitMax: maxPerMinute });
}
