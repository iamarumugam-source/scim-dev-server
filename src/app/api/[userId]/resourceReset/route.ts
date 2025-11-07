import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/scim/db";

interface RouteParams {
  params: { userId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  console.log(`Starting database seeding for tenant: ${userId}`);

  try {
    console.log(`Removing all users and groups for tenant: ${userId}...`);

    const { error: deleteGroupsError } = await supabase
      .from("scim_groups")
      .delete()
      .eq("tenantId", userId);
    if (deleteGroupsError)
      throw new Error(
        `Failed to delete existing groups: ${deleteGroupsError.message}`
      );

    const { error: deleteUsersError } = await supabase
      .from("scim_users")
      .delete()
      .eq("tenantId", userId);
    if (deleteUsersError)
      throw new Error(
        `Failed to delete existing users: ${deleteUsersError.message}`
      );

    console.log("Successfully removed existing data.");

    const message = `Database reset completed for tenant ${userId}`;
    console.log(message);
    return NextResponse.json({ message });
  } catch (error: any) {
    console.error("Failed to seed database:", error);
    return NextResponse.json(
      { detail: "Internal Server Error", error: error.message },
      { status: 500 }
    );
  }
}
