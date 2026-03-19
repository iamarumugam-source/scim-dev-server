import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { supabase } from "@/lib/scim/db";

interface RouteParams {
  params: Promise<{ userId: string }>;
}

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).id !== userId) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  // Fetch all logins in the last 53 weeks (371 days)
  const since = new Date();
  since.setDate(since.getDate() - 371);

  const [{ data, error }, { count: total }] = await Promise.all([
    supabase
      .from("login_activity")
      .select("logged_at")
      .eq("tenantId", userId)
      .gte("logged_at", since.toISOString())
      .order("logged_at", { ascending: true }),
    supabase
      .from("login_activity")
      .select("id", { count: "exact", head: true })
      .eq("tenantId", userId),
  ]);

  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }

  // Return raw ISO timestamps — the client aggregates into local-timezone dates
  // so the heatmap cells always align with the user's clock, not the server's UTC.
  const timestamps = (data ?? []).map((r) => r.logged_at as string);

  return NextResponse.json({ timestamps, total: total ?? 0 });
}

/** POST /api/[userId]/login-activity — record one login event. */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).id !== userId) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("login_activity")
    .insert({ tenantId: userId });

  if (error) {
    return NextResponse.json({ detail: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
