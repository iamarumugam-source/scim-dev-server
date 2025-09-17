import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from '@/lib/scim/services/apiKeyService';

const apiKeyService = new ApiKeyService();
interface RouteParams {
    params: { userId: string };
}

export async function GET(req: NextRequest, { params }: RouteParams) {
    const { userId } = await params;
    
    try {
        const keys = await apiKeyService.getKeys(userId);
        return NextResponse.json(keys);
    } catch (error: any) {
        return NextResponse.json({ detail: error.message }, { status: 500 });
    }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
    const { userId } = await params;
    try {
        const { name } = await req.json();
        if (!name) {
            return NextResponse.json({ detail: 'Key name is required.' }, { status: 400 });
        }
        const newKey = await apiKeyService.generateKey(name, userId);
        return NextResponse.json(newKey, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ detail: error.message }, { status: 500 });
    }
}