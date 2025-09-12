import { NextRequest, NextResponse } from 'next/server';
import { ApiKeyService } from './services/apiKeyService';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const apiKeyService = new ApiKeyService();


export async function protectWithApiKey(request: NextRequest): Promise<NextResponse | null> {
    const session = await getServerSession(authOptions);
    if (session && session.user) {
        return null;
    }
    
    const authHeader = request.headers.get('Authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const apiKey = authHeader.substring(7); // Remove "Bearer " prefix
        const isValid = await apiKeyService.validateKey(apiKey);

        if (isValid) {
            return null;
        }
    }

    
    return NextResponse.json(
        { detail: 'Unauthorized. A valid session or API key is required.' },
        { status: 401 }
    );
}