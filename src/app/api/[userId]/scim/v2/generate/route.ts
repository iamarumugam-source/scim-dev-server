import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/scim/db';
import { faker } from '@faker-js/faker';
import { ScimUser, ScimGroup } from '@/lib/scim/models/scimSchemas';

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
        const userCount = typeof body.userCount === 'number' ? Math.min(body.userCount, 1000) : 20; // Cap at 1000
        const groupCount = typeof body.groupCount === 'number' ? Math.min(body.groupCount, 100) : 5;   // Cap at 100
        
        console.log(`Configuration - Delete Existing: ${deleteExisting}, User Count: ${userCount}, Group Count: ${groupCount}`);

        if (deleteExisting) {
            console.log(`'deleteExisting' is true. Removing all users and groups for tenant: ${userId}...`);
            
            const { error: deleteGroupsError } = await supabase.from('scim_groups').delete().eq('tenantId', userId);
            if (deleteGroupsError) throw new Error(`Failed to delete existing groups: ${deleteGroupsError.message}`);

            const { error: deleteUsersError } = await supabase.from('scim_users').delete().eq('tenantId', userId);
            if (deleteUsersError) throw new Error(`Failed to delete existing users: ${deleteUsersError.message}`);
            
            console.log('Successfully removed existing data.');
        }

        let existingUsers: ScimUser[] = [];
        if (!deleteExisting) {
            const { data: existingUsersData, error: fetchError } = await supabase
                .from('scim_users')
                .select('resource')
                .eq('tenantId', userId);
            
            if (fetchError) throw new Error(`Failed to fetch existing users: ${fetchError.message}`);

            existingUsers = (existingUsersData?.map(u => u.resource) || []) as ScimUser[];
            console.log(`Found ${existingUsers.length} existing users to include in new groups.`);
        }

        const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000');
        const users: ScimUser[] = [];
        for (let i = 0; i < userCount; i++) {
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();
            const id = faker.string.uuid();
            const now = new Date().toISOString();
            users.push({
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                id,
                userName: faker.internet.username({ firstName, lastName }),
                name: { givenName: firstName, familyName: lastName, formatted: `${firstName} ${lastName}` },
                emails: [{ primary: true, value: faker.internet.exampleEmail({ firstName, lastName }) }],
                active: true,
                meta: {
                    resourceType: 'User',
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
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                id,
                displayName: `${faker.company.name()} Team`,
                members: [],
                meta: {
                    resourceType: 'Group',
                    created: now,
                    lastModified: now,
                    location: `${BASE_URL}/api/${userId}/scim/v2/Groups/${id}`,
                    version: `W/"${Date.now()}"`,
                },
            });
        }
        console.log(`Generated ${groups.length} new groups.`);

    
        const allUsers = [...existingUsers, ...users];
        if (allUsers.length > 0) {
            groups.forEach(group => {
                const memberCount = faker.number.int({ min: 1, max: Math.min(allUsers.length, 10) });
                const shuffledUsers = faker.helpers.shuffle(allUsers);
                for (let i = 0; i < memberCount; i++) {
                    const user = shuffledUsers[i];
                    if (group.members && user.id) {
                         group.members.push({
                            value: user.id,
                            display: user.userName,
                            $ref: `${BASE_URL}/api/${userId}/scim/v2/Users/${user.id}`,
                        });
                    }
                }
            });
            console.log('Assigned users to new groups.');
        }


        const usersToInsert = users.map(user => ({
            id: user.id, username: user.userName, active: user.active, resource: user, tenantId: userId
        }));
        const groupsToInsert = groups.map(group => ({
            id: group.id, display_name: group.displayName, resource: group, tenantId: userId
        }));

        console.log('Inserting new data into Supabase...');
        if (usersToInsert.length > 0) {
            const { error: userError } = await supabase.from('scim_users').insert(usersToInsert);
            if (userError) throw new Error(`User insertion failed: ${userError.message}`);
        }
        if (groupsToInsert.length > 0) {
            const { error: groupError } = await supabase.from('scim_groups').insert(groupsToInsert);
            if (groupError) throw new Error(`Group insertion failed: ${groupError.message}`);
        }
        
        const message = `Database seeding completed. Deleted existing data: ${deleteExisting}. Generated: ${users.length} users, ${groups.length} groups.`;
        console.log(message);
        return NextResponse.json({ message });

    } catch (error: any) {
        console.error('Failed to seed database:', error);
        return NextResponse.json({ detail: 'Internal Server Error', error: error.message }, { status: 500 });
    }
}