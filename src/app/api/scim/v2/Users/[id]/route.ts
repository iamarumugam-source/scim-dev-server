import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/scim/services/userService';
import { ScimError } from '@/lib/scim/models/scimSchemas';
import { logExternalRequest } from '@/lib/scim/logging'; // 1. Import the logger
import { protectWithApiKey } from '@/lib/scim/apiHelper';

const userService = new UserService();

// Defines the expected shape of the route's parameters.
interface RouteParams {
    params: { id: string };
}

// Helper to create a consistent 404 Not Found response.
const notFoundResponse = (): NextResponse<ScimError> => {
    return NextResponse.json({
        schemas: ["urn:ietf:params:scim:api:2.0:Error"],
        detail: "User not found",
        status: "404",
    }, { status: 404 });
};


export async function GET(request: NextRequest, { params }: RouteParams) {
    const unauthorizedResponse = await protectWithApiKey(request);
    console.log(unauthorizedResponse)
        if (unauthorizedResponse) {
            return unauthorizedResponse; 
        }
    logExternalRequest(request);

    try {
        const user = await userService.getUserById(params.id);
        if (!user) {
            return notFoundResponse();
        }
        return NextResponse.json(user);
    } catch (error: any) {
        return NextResponse.json({ detail: error.message, status: "500" }, { status: 500 });
    }
}


export async function PUT(request: NextRequest, { params }: RouteParams) {
    const unauthorizedResponse = await protectWithApiKey(request);
    if (unauthorizedResponse) {
        return unauthorizedResponse; 
    }
    logExternalRequest(request);

    try {
        const body = await request.json();
        const updatedUser = await userService.updateUser(params.id, body);
        if (!updatedUser) {
            return notFoundResponse();
        }
        return NextResponse.json(updatedUser);
    } catch (error: any) {
        return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "400" }, { status: 400 });
    }
}


export async function DELETE(request: NextRequest, { params }: RouteParams) {
    const unauthorizedResponse = await protectWithApiKey(request);
    if (unauthorizedResponse) {
        return unauthorizedResponse; 
    }
    logExternalRequest(request);

    try {
        const success = await userService.deleteUser(params.id);
        if (!success) {
            return notFoundResponse();
        }
        return new NextResponse(null, { status: 204 });
    } catch (error: any) {
        return NextResponse.json({ detail: error.message, status: "500" }, { status: 500 });
    }
}

