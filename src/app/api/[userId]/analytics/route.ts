import { NextRequest, NextResponse } from "next/server";
import { AnalyticsService } from "@/lib/scim/services/analyticsService";

interface RouteParams {
  params: { userId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const body        = await request.json().catch(() => ({}));
    const path        = typeof body.path === "string" ? body.path : "/";

    const analyticsService = new AnalyticsService();
    await analyticsService.recordPageView(userId, path);

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
