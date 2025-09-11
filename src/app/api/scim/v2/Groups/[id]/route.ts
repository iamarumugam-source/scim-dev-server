import { NextRequest, NextResponse } from 'next/server';
import { GroupService } from '@/lib/scim/services/groupService';
import { ScimError } from '@/lib/scim/models/scimSchemas';

const groupService = new GroupService();

// Defines the expected shape of the route's parameters.
interface RouteParams {
    params: { id: string };
}

// Helper to create a consistent 404 Not Found response.
const notFoundResponse = (): NextResponse<ScimError> => {
    return NextResponse.json({
        schemas: ["urn:ietf:params:scim:api:2.0:Error"],
        detail: "Group not found",
        status: "404",
    }, { status: 404 });
};

/**
 * GET /api/scim/v2/Groups/{id}
 * @description Retrieves a single group by ID.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const group = await groupService.getGroupById(params.id);
        if (!group) {
            return notFoundResponse();
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
            return notFoundResponse();
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
            return notFoundResponse();
        }
        return new NextResponse(null, { status: 204 });
    } catch (error: any) {
        return NextResponse.json({ detail: error.message, status: "500" }, { status: 500 });
    }
}

