import { NextRequest, NextResponse } from 'next/server';
import { GroupService } from '@/lib/scim/services/groupService';
import { ScimListResponse, ScimGroup } from '@/lib/scim/models/scimSchemas';
import { logExternalRequest } from '@/lib/scim/logging'; 
import { protectWithApiKey } from '@/lib/scim/apiHelper';

const groupService = new GroupService();

interface RouteParams {
    params: { userId: string };
}

function createAndLogResponse(
    request: NextRequest,
    data: any,
    options: { status: number },
    userId: string
): NextResponse {
    const response = NextResponse.json(data, options);
    logExternalRequest(request, response, data, userId);
    return response;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
    const { userId } = await params;
    const unauthorizedResponse = await protectWithApiKey(request);
    if (unauthorizedResponse) {
        const errorData = { detail: 'Unauthorized' };
        return createAndLogResponse(request, errorData, { status: 401 }, userId);
    }
    
    const { searchParams } = new URL(request.url);
    const startIndex = parseInt(searchParams.get('startIndex') || '1', 10);
    const count = parseInt(searchParams.get('count') || '10', 10);

    try {
        const { groups, total } = await groupService.getGroups(startIndex, count, userId);
        const listResponse: ScimListResponse<ScimGroup> = {
            schemas: ["urn:ietf:params:scim:api:2.0:ListResponse"],
            totalResults: total,
            itemsPerPage: groups.length,
            startIndex: startIndex,
            Resources: groups,
        };
        return createAndLogResponse(request, listResponse, { status: 200 }, userId);
    } catch (error: any) {
        const errorData = { detail: error.message, status: "500" };
        return createAndLogResponse(request, errorData, { status: 500 }, userId);
    }
}


export async function POST(request: NextRequest, { params }: RouteParams) {
    const { userId } = await params;
    const unauthorizedResponse = await protectWithApiKey(request);
    if (unauthorizedResponse) {
        const errorData = { detail: 'Unauthorized' };
        return createAndLogResponse(request, errorData, { status: 401 }, userId);
    }
    
    try {
        const body = await request.json();
        const newGroup = await groupService.createGroup(body);
        return createAndLogResponse(request, newGroup, { status: 201 }, userId);
    } catch (error: any) {
         if (error.message.includes('already exists')) {
            const errorData = { schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "409" };
            return createAndLogResponse(request, errorData, { status: 409 }, userId);
        }
        const errorData = { schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "400" };
        return createAndLogResponse(request, errorData, { status: 400 }, userId);
    }
}


// export async function DELETE(request: NextRequest, { params }: RouteParams) {
//     const { userId } = params;
//     // ... auth checks ...
//
//     try {
//         const deleteResult = await groupService.deleteAllGroups(); // Assuming this is the action
//         return createAndLogResponse(request, deleteResult, { status: 200 }, userId);
//     } catch (error: any) {
//         const errorData = { schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message };
//         return createAndLogResponse(request, errorData, { status: 400 }, userId);
//     }
// }