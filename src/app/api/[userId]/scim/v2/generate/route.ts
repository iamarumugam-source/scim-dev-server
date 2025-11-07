import { NextResponse, type NextRequest } from "next/server";
import { supabase } from "@/lib/scim/db";
import { faker } from "@faker-js/faker";
import { ScimUser, ScimGroup } from "@/lib/scim/models/scimSchemas";

interface RouteParams {
  params: { userId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  console.log(`Starting database seeding for tenant: ${userId}`);

  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      body = {};
    }

    const deleteExisting = body.deleteExisting === true;
    const userCount =
      typeof body.userCount === "number" ? Math.min(body.userCount, 1000) : 20;
    const groupCount =
      typeof body.groupCount === "number" ? Math.min(body.groupCount, 100) : 5;

    console.log(
      `Configuration - Delete Existing: ${deleteExisting}, User Count: ${userCount}, Group Count: ${groupCount}`
    );

    if (deleteExisting) {
      console.log(
        `'deleteExisting' is true. Removing all users and groups for tenant: ${userId}...`
      );
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
    }

    let existingUsers: ScimUser[] = [];
    if (!deleteExisting) {
      const { data: existingUsersData, error: fetchError } = await supabase
        .from("scim_users")
        .select("resource")
        .eq("tenantId", userId);

      if (fetchError)
        throw new Error(
          `Failed to fetch existing users: ${fetchError.message}`
        );

      existingUsers = (existingUsersData?.map((u) => u.resource) ||
        []) as ScimUser[];

      existingUsers.forEach((user) => {
        if (!user.groups) {
          user.groups = [];
        }
      });

      console.log(
        `Found ${existingUsers.length} existing users to include in new groups.`
      );
    }

    const BASE_URL =
      process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const users: ScimUser[] = [];
    for (let i = 0; i < userCount; i++) {
      const firstName = faker.person.firstName();
      const lastName = faker.person.lastName();
      const id = faker.string.uuid();
      const now = new Date().toISOString();
      users.push({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:User"],
        id,
        userName: faker.internet.username({ firstName, lastName }),
        name: {
          givenName: firstName,
          familyName: lastName,
          formatted: `${firstName} ${lastName}`,
        },
        emails: [
          {
            primary: true,
            value: faker.internet.exampleEmail({ firstName, lastName }),
          },
        ],
        active: true,
        groups: [],
        meta: {
          resourceType: "User",
          created: now,
          lastModified: now,
          location: `${BASE_URL}/api/${userId}/scim/v2/Users/${id}`,
          version: `W/"${Date.now()}"`,
        },
      });
    }
    console.log(`Generated ${users.length} new users.`);

    const groups: ScimGroup[] = [];
    for (let i = 0; i < groupCount; i++) {
      const id = faker.string.uuid();
      const now = new Date().toISOString();
      groups.push({
        schemas: ["urn:ietf:params:scim:schemas:core:2.0:Group"],
        id,
        displayName: `${faker.company.name()} Team`,
        members: [],
        meta: {
          resourceType: "Group",
          created: now,
          lastModified: now,
          location: `${BASE_URL}/api/${userId}/scim/v2/Groups/${id}`,
          version: `W/"${Date.now()}"`,
        },
      });
    }
    console.log(`Generated ${groups.length} new groups.`);

    const allUsers = [...existingUsers, ...users];
    if (allUsers.length > 0 && groups.length > 0) {
      groups.forEach((group) => {
        const memberCount = faker.number.int({
          min: 1,
          max: Math.min(allUsers.length, 10),
        });

        const shuffledUsers = faker.helpers.shuffle(allUsers);
        const members = shuffledUsers.slice(0, memberCount);

        for (const user of members) {
          if (group.members && user.id && group.id && group.displayName) {
            group.members.push({
              value: user.id,
              display: user.userName,
              $ref: `${BASE_URL}/api/${userId}/scim/v2/Users/${user.id}`,
            });

            if (user.groups) {
              user.groups.push({
                value: group.id,
                display: group.displayName,
                $ref: `${BASE_URL}/api/${userId}/scim/v2/Groups/${group.id}`,
              });
            }
          }
        }
      });
      console.log("Assigned users to new groups and groups to users.");
    }

    const usersToInsert = users.map((user) => ({
      id: user.id,
      username: user.userName,
      active: user.active,
      resource: user,
      tenantId: userId,
    }));

    const usersToUpdate = existingUsers.map((user) => ({
      id: user.id,
      username: user.userName,
      active: user.active,
      resource: user,
      tenantId: userId,
    }));

    const groupsToInsert = groups.map((group) => ({
      id: group.id,
      display_name: group.displayName,
      resource: group,
      tenantId: userId,
    }));

    console.log("Inserting and updating data in Supabase...");
    if (usersToInsert.length > 0) {
      const { error: userError } = await supabase
        .from("scim_users")
        .insert(usersToInsert);
      if (userError)
        throw new Error(`New user insertion failed: ${userError.message}`);
    }

    if (usersToUpdate.length > 0) {
      const { error: userUpdateError } = await supabase
        .from("scim_users")
        .upsert(usersToUpdate, { onConflict: "id" });
      if (userUpdateError)
        throw new Error(
          `Existing user update failed: ${userUpdateError.message}`
        );
    }

    if (groupsToInsert.length > 0) {
      const { error: groupError } = await supabase
        .from("scim_groups")
        .insert(groupsToInsert);
      if (groupError)
        throw new Error(`Group insertion failed: ${groupError.message}`);
    }

    const message = `Database seeding completed. Deleted existing data: ${deleteExisting}. Generated: ${users.length} users, ${groups.length} groups. Updated: ${existingUsers.length} existing users.`;
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
