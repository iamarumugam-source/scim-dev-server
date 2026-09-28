import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { CimdService } from "@/lib/scim/services/cimdService";

interface RouteParams { params: Promise<{ userId: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { id?: string }).id !== userId)
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });

  const svc = new CimdService();
  return NextResponse.json({ fetches: await svc.listFetches(userId) });
}
