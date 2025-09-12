import { NextRequest, NextResponse } from 'next/server';
import { GroupService } from '@/lib/scim/services/groupService';
import { ScimError } from '@/lib/scim/models/scimSchemas';
import { logExternalRequest } from '@/lib/scim/logging'; // 1. Import the logger
import { protectWithApiKey } from '@/lib/scim/apiHelper';
const groupService = new GroupService();


interface RouteParams {
    params: { id: string };
}


const notFoundResponse = (): NextResponse<ScimError> => {
    return NextResponse.json({
        schemas: ["urn:ietf:params:scim:api:2.0:Error"],
        detail: "Group not found",
        status: "404",
    }, { status: 404 });
};

export async function GET(request: NextRequest, { params }: RouteParams) {
    const unauthorizedResponse = await protectWithApiKey(request);
    if (unauthorizedResponse) {
        return unauthorizedResponse; 
    }
    logExternalRequest(request)
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


export async function PUT(request: NextRequest, { params }: RouteParams) {
    const unauthorizedResponse = await protectWithApiKey(request);
    if (unauthorizedResponse) {
        return unauthorizedResponse; 
    }
    logExternalRequest(request)
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


export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const unauthorizedResponse = await protectWithApiKey(request);
    
    if (unauthorizedResponse) {
        return unauthorizedResponse; 
    }
    logExternalRequest(request)
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

