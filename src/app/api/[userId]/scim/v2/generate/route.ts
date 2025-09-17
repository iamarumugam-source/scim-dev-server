import { NextResponse, type NextRequest } from 'next/server';
import { supabase } from '@/lib/scim/db';
import { faker } from '@faker-js/faker';
import { ScimUser, ScimGroup } from '@/lib/scim/models/scimSchemas';

interface RouteParams {
    params: { userId: string };
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    try {
        const userCount = 20;
        const groupCount = 5;
        const { userId } = await params
        const BASE_URL = (process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000') + userId;
        console.log('Starting database seeding...');

        const { data: existingUsersData, error: fetchError } = await supabase
            .from('scim_users')
            .select('resource')
            .eq('tenantId', userId);
        
        // return;
        if (fetchError) {
            throw new Error(`Failed to fetch existing users: ${fetchError.message}`);
        }

        const existingUsers: ScimUser[] = (existingUsersData?.map(u => u.resource) || []) as ScimUser[];
        console.log(`Found ${existingUsers.length} existing users.`);


        const users: ScimUser[] = [];
        for (let i = 0; i < userCount; i++) {
            const firstName = faker.person.firstName();
            const lastName = faker.person.lastName();
            const id = faker.string.uuid();
            const now = new Date().toISOString();

            const user: ScimUser = {
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
                id,
                userName: faker.internet.username({ firstName, lastName }),
                name: {
                    givenName: firstName,
                    familyName: lastName,
                    formatted: `${firstName} ${lastName}`,
                },
                emails: [{ primary: true, value: faker.internet.exampleEmail({ firstName, lastName }) }],
                active: true,
                meta: {
                    resourceType: 'User',
                    created: now,
                    lastModified: now,
                    location: `${BASE_URL}/api/scim/v2/Users/${id}`,
                    version: `W/"${Date.now()}"`,
                },
            };
            users.push(user);
        }
        console.log(`Generated ${users.length} new users.`);

        // 3. Generate new Groups
        const groups: ScimGroup[] = [];
        for (let i = 0; i < groupCount; i++) {
            const id = faker.string.uuid();
            const now = new Date().toISOString();
            const group: ScimGroup = {
                schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'],
                id,
                displayName: `${faker.company.name()} Team`,
                members: [],
                meta: {
                    resourceType: 'Group',
                    created: now,
                    lastModified: now,
                    location: `${BASE_URL}/api/scim/v2/Groups/${id}`,
                    version: `W/"${Date.now()}"`,
                },
            };
            groups.push(group);
        }
        console.log(`Generated ${groups.length} new groups.`);

        // 4. Assign users to groups (can include existing and new users)
        const allUsers = [...existingUsers, ...users];
        groups.forEach(group => {
            if (allUsers.length > 0) {
                const memberCount = faker.number.int({ min: 2, max: Math.min(allUsers.length, 10) });
                const shuffledUsers = faker.helpers.shuffle(allUsers);
                for (let i = 0; i < memberCount; i++) {
                    const user = shuffledUsers[i];
                    if (group.members && user.id) {
                         group.members.push({
                            value: user.id,
                            display: user.userName,
                            $ref: `${BASE_URL}/api/scim/v2/Users/${user.id}`,
                        });
                    }
                }
            }
        });
        console.log('Assigned users to new groups.');

        // 5. Prepare data for Supabase insertion
        const usersToInsert = users.map(user => ({
            id: user.id,
            username: user.userName,
            active: user.active,
            resource: user,
            tenantId: userId
        }));

        const groupsToInsert = groups.map(group => ({
            id: group.id,
            display_name: group.displayName,
            resource: group,
            tenantId: userId
        }));

        // 6. Insert new data into Supabase
        console.log('Inserting new data into Supabase...');
        if (usersToInsert.length > 0) {
            const { error: userError } = await supabase.from('scim_users').insert(usersToInsert);
            if (userError) throw new Error(`User insertion failed: ${userError.message}`);
        }

        if (groupsToInsert.length > 0) {
            const { error: groupError } = await supabase.from('scim_groups').insert(groupsToInsert);
            if (groupError) throw new Error(`Group insertion failed: ${groupError.message}`);
        }
        

        console.log('Database seeding completed successfully!');
        
        return NextResponse.json({ message: 'Database seeding completed successfully.' });

    } catch (error: any) {
        console.error('Failed to seed database:', error);
        return NextResponse.json({ detail: 'Internal Server Error', error: error.message }, { status: 500 });
    }
}

