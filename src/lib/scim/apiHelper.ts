import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from './services/apiKeyService';

const apiKeyService = new ApiKeyService();


export async function protectWithApiKey(request: NextRequest): Promise<NextResponse | null> {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json({ detail: 'Authorization header is missing or invalid.' }, { status: 401 });
    }

    const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
    const isValid = await apiKeyService.validateKey(apiKey);

    if (!isValid) {
        return NextResponse.json({ detail: 'Invalid API Key.' }, { status: 401 });
    }

    
    return null;
}