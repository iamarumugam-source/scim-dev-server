import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/scim/services/userService';
import { ScimListResponse, ScimUser } from '@/lib/scim/models/scimSchemas';
import { logExternalRequest } from '@/lib/scim/logging'; // 1. Import the logger
import { protectWithApiKey } from '@/lib/scim/apiHelper';

const userService = new UserService();


export async function GET(request: NextRequest) {
    const unauthorizedResponse = await protectWithApiKey(request);
    if (unauthorizedResponse) {
        return unauthorizedResponse; 
    }
    logExternalRequest(request);

    const { searchParams } = new URL(request.url);
    const startIndex = parseInt(searchParams.get('startIndex') || '1', 10);
    const count = parseInt(searchParams.get('count') || '10', 10);
    
    try {
        const { users, total } = await userService.getUsers(startIndex, count);
        const listResponse: ScimListResponse<ScimUser> = {
            schemas: ["urn:ietf:params:scim:api:2.0:ListResponse"],
            totalResults: total,
            itemsPerPage: users.length,
            startIndex: startIndex,
            Resources: users,
        };
        return NextResponse.json(listResponse);
    } catch (error: any) {
        return NextResponse.json({ detail: error.message, status: "500" }, { status: 500 });
    }
}


export async function POST(request: NextRequest) {
    const unauthorizedResponse = await protectWithApiKey(request);
    if (unauthorizedResponse) {
        return unauthorizedResponse; 
    }
    logExternalRequest(request);

    try {
        const body = await request.json();
        const newUser = await userService.createUser(body);
        return NextResponse.json(newUser, { status: 201 });
    } catch (error: any) {
         if (error.message.includes('already exists')) {
            return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "409" }, { status: 409 });
        }
        return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "400" }, { status: 400 });
    }
}

// export async function DELETE(request: NextRequest) {
//     try {
//         const deleteUsers = await userService.deleteAllUsers()
//         return NextResponse.json(deleteUsers, {status: 200})
        
//     } catch (error: any) {
//         return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "400" }, { status: 400 });
//     }
// }