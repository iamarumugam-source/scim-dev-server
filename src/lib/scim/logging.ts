import { NextRequest } from 'next/server';

const APP_HOST = process.env.NEXT_PUBLIC_BASE_URL!;

const LOG_API_URL = `${APP_HOST}/api/scim/v2/logs`;


function isExternalRequest(request: NextRequest): boolean {
    const origin = request.headers.get('origin');
    const referer = request.headers.get('referer');
    
    if (!origin && !referer) {
        return true;
    }

    if (origin && !origin.startsWith(APP_HOST)) {
        return true;
    }
    
    if (referer && !referer.startsWith(APP_HOST)) {
        return true;
    }

    return false;
}

export async function logExternalRequest(request: NextRequest): Promise<void> {
     let payload: any = null;
        if (request.method === 'POST' || request.method === 'PUT' || request.method === 'PATCH') {
            try {
                payload = await request.clone().json();
            } catch (error) {
                payload = { error: "Could not parse request body as JSON." };
            }
        }
    if (isExternalRequest(request)) {
        const logPayload = {
            timestamp: new Date().toISOString(),
            method: request.method,
            path: request.nextUrl.pathname,
            userAgent: request.headers.get('user-agent') || 'unknown',
            ip: (request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim(),
            payload: payload
        };

        fetch(LOG_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(logPayload),
        }).catch(err => {
            console.error('Failed to send log to internal endpoint:', err);
        });
    }
}

