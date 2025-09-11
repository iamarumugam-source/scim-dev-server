import { NextRequest, NextResponse } from 'next/server';
import { GroupService } from '@/lib/scim/services/groupService';
import { ScimListResponse, ScimGroup } from '@/lib/scim/models/scimSchemas';

const groupService = new GroupService();

/**
 * GET /api/scim/v2/Groups
 * @description Retrieves a list of groups.
 */
export async function GET(request: NextRequest) {
    const { searchParams } = new URL(request.url);
    const startIndex = parseInt(searchParams.get('startIndex') || '1', 10);
    const count = parseInt(searchParams.get('count') || '10', 10);

    try {
        const { groups, total } = await groupService.getGroups(startIndex, count);
        const listResponse: ScimListResponse<ScimGroup> = {
            schemas: ["urn:ietf:params:scim:api:2.0:ListResponse"],
            totalResults: total,
            itemsPerPage: groups.length,
            startIndex: startIndex,
            Resources: groups,
        };
        return NextResponse.json(listResponse);
    } catch (error: any) {
        return NextResponse.json({ detail: error.message, status: "500" }, { status: 500 });
    }
}

/**
 * POST /api/scim/v2/Groups
 * @description Creates a new group.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const newGroup = await groupService.createGroup(body);
        return NextResponse.json(newGroup, { status: 201 });
    } catch (error: any) {
         if (error.message.includes('already exists')) {
            return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "409" }, { status: 409 });
        }
        return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "400" }, { status: 400 });
    }
}

