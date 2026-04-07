import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { LoginActivityService } from "@/lib/scim/services/loginActivityService";

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

  const loginActivityService = new LoginActivityService();
  try {
    const { timestamps, total } = await loginActivityService.getActivity(userId, since);
    return NextResponse.json({ timestamps, total });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}

/** POST /api/[userId]/login-activity — record one login event. */
export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as any).id !== userId) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const loginActivityService = new LoginActivityService();
  try {
    await loginActivityService.recordLogin(userId);
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (err: any) {
    return NextResponse.json({ detail: err.message }, { status: 500 });
  }
}
