import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/scim/db";

interface RouteParams {
  params: { userId: string };
}

interface ResetSelections {
  users?:       boolean;
  groups?:      boolean;
  entitlements?: boolean;
  roles?:       boolean;
  logs?:        boolean;
  pageViews?:   boolean;
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

  // If no specific selections provided, reset all
  const resetAll = Object.keys(selections).length === 0;
  const should = (key: keyof ResetSelections) => resetAll || selections[key] === true;

  try {
    if (should("roles")) {
      const { error } = await supabase.from("scim_roles").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete roles: ${error.message}`);
    }

    if (should("entitlements")) {
      const { error } = await supabase.from("scim_entitlements").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete entitlements: ${error.message}`);
    }

    if (should("groups")) {
      const { error } = await supabase.from("scim_groups").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete groups: ${error.message}`);
    }

    if (should("users")) {
      const { error } = await supabase.from("scim_users").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete users: ${error.message}`);
    }

    if (should("logs")) {
      const { error } = await supabase.from("scim_logs").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete logs: ${error.message}`);
    }

    if (should("pageViews")) {
      const { error } = await supabase.from("scim_page_views").delete().eq("tenantId", userId);
      if (error) throw new Error(`Failed to delete page views: ${error.message}`);
    }

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
