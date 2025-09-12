import { NextRequest } from 'next/server';

const APP_HOST = `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` || 'http://localhost:3000';

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

export function logExternalRequest(request: NextRequest): void {
    if (isExternalRequest(request)) {
        console.log(request)
        const logPayload = {
            timestamp: new Date().toISOString(),
            method: request.method,
            path: request.nextUrl.pathname,
            userAgent: request.headers.get('user-agent') || 'unknown',
            ip: (request.headers.get('x-forwarded-for') ?? '127.0.0.1').split(',')[0].trim()
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

