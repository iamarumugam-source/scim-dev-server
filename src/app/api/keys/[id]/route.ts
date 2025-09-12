import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/scim/services/apiKeyService';

const apiKeyService = new ApiKeyService();

interface RouteContext {
    params: { id: string; }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
    const { id } = context.params;
    try {
        const success = await apiKeyService.revokeKey(id);
        if (!success) {
            return NextResponse.json({ detail: 'API Key not found.' }, { status: 404 });
        }
        return new NextResponse(null, { status: 204 }); // Success, no content
    } catch (error: any) {
        return NextResponse.json({ detail: error.message }, { status: 500 });
    }
}