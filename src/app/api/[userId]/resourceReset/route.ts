import { NextResponse, type NextRequest } from "next/server";
import { ResourceResetService, ResetSelections } from "@/lib/scim/services/resourceResetService";

interface RouteParams {
  params: { userId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  let selections: ResetSelections = {};
  try {
    const body = await request.json();
    selections = body ?? {};
  } catch {
    // No body — default to resetting everything for backward compatibility
    selections = { users: true, groups: true, entitlements: true, roles: true, logs: true, pageViews: true };
  }

  try {
    const resetService = new ResourceResetService();
    await resetService.reset(userId, selections);

    const cleared = Object.entries(selections)
      .filter(([, v]) => v)
      .map(([k]) => k)
      .join(", ");

    return NextResponse.json({ message: `Reset completed for: ${cleared || "all data"}` });
  } catch (error: any) {
    console.error("Reset failed:", error);
    return NextResponse.json({ detail: "Internal Server Error", error: error.message }, { status: 500 });
  }
}
