import { NextRequest, NextResponse } from 'next/server';
import { GroupService } from '@/lib/scim/services/groupService';

const groupService = new GroupService();

interface RouteParams {
    params: { id: string };
}

/**
 * GET /api/scim/v2/Groups/{id}
 * @description Retrieves a single group by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const group = await groupService.getGroupById(params.id);
        if (!group) {
            return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: 'Group not found', status: "404" }, { status: 404 });
        }
        return NextResponse.json(group);
    } catch (error: any) {
        return NextResponse.json({ detail: error.message, status: "500" }, { status: 500 });
    }
}

/**
 * PUT /api/scim/v2/Groups/{id}
 * @description Replaces a group's content.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const body = await request.json();
        const updatedGroup = await groupService.updateGroup(params.id, body);
        if (!updatedGroup) {
            return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: 'Group not found', status: "404" }, { status: 404 });
        }
        return NextResponse.json(updatedGroup);
    } catch (error: any) {
        return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "400" }, { status: 400 });
    }
}

/**
 * DELETE /api/scim/v2/Groups/{id}
 * @description Deletes a group.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const success = await groupService.deleteGroup(params.id);
        if (!success) {
            return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: 'Group not found', status: "404" }, { status: 404 });
        }
        return new NextResponse(null, { status: 204 });
    } catch (error: any) {
        return NextResponse.json({ detail: error.message, status: "500" }, { status: 500 });
    }
}

