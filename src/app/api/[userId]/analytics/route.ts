import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/scim/db";

interface RouteParams {
  params: { userId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { userId } = await params;
    const body        = await request.json().catch(() => ({}));
    const path        = typeof body.path === "string" ? body.path : "/";

    const { error } = await supabase.rpc("increment_page_view", {
      p_tenant_id: userId,
      p_path:      path,
    });

    if (error) {
      // Fail silently — analytics should never break the app.
      console.warn("[analytics] Could not record page view:", error.message);
    }

    return NextResponse.json({ ok: true }, { status: 202 });
  } catch {
    return NextResponse.json({ ok: false }, { status: 202 });
  }
}
