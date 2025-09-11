import { NextRequest, NextResponse } from 'next/server';
import { UserService } from '@/lib/scim/services/userService';

const userService = new UserService();

interface RouteParams {
    params: { id: string };
}

/**
 * GET /api/scim/v2/Users/{id}
 * @description Retrieves a single user by ID.
 * @see https://tools.ietf.org/html/rfc7644#section-3.4.1
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const user = await userService.getUserById(params.id);
        if (!user) {
            return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: 'User not found', status: "404" }, { status: 404 });
        }
        return NextResponse.json(user);
    } catch (error: any) {
        return NextResponse.json({ detail: error.message, status: "500" }, { status: 500 });
    }
}

/**
 * PUT /api/scim/v2/Users/{id}
 * @description Replaces a user's content.
 * @see https://tools.ietf.org/html/rfc7644#section-3.5.1
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
    try {
        const body = await request.json();
        const updatedUser = await userService.updateUser(params.id, body);
        if (!updatedUser) {
            return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: 'User not found', status: "404" }, { status: 404 });
        }
        return NextResponse.json(updatedUser);
    } catch (error: any) {
        return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: error.message, status: "400" }, { status: 400 });
    }
}


/**
 * DELETE /api/scim/v2/Users/{id}
 * @description Deletes a user.
 * @see https://tools.ietf.org/html/rfc7644#section-3.6
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const success = await userService.deleteUser(params.id);
        if (!success) {
            return NextResponse.json({ schemas: ["urn:ietf:params:scim:api:2.0:Error"], detail: 'User not found', status: "404" }, { status: 404 });
        }
        return new NextResponse(null, { status: 204 });
    } catch (error: any) {
        return NextResponse.json({ detail: error.message, status: "500" }, { status: 500 });
    }
}

