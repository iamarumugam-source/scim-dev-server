import { NextRequest, NextResponse } from "next/server";

const APP_HOST = process.env.NEXT_PUBLIC_BASE_URL!;

function getLogApiUrl(userId: string) {
  return `${APP_HOST}/api/${userId}/scim/v2/logs`;
}

function isExternalRequest(request: NextRequest): boolean {
  const origin = request.headers?.get("origin") || "";
  const referer = request.headers?.get("referer") || "";

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

export async function logExternalRequest(
  request: NextRequest,
  response: NextResponse,
  responseData: any,
  userId: string,
): Promise<void> {
  const LOG_API_URL = getLogApiUrl(userId);

  let payload: any;
  if (
    request.method === "POST" ||
    request.method === "PUT" ||
    request.method === "PATCH"
  ) {
    try {
      payload = await request.json();
    } catch (error) {
      payload = { error: "Could not parse request body as JSON." };
      console.log(error);
    }
  }
  if (isExternalRequest(request)) {
    const logPayload = {
      timestamp: new Date().toISOString(),
      path: request.nextUrl.pathname,
      request: serializeRequest(request, payload),
      responseStatus: {
        status: response.status,
        statusText: response.statusText,
      },
      responseData,
    };

    // console.log(logPayload)

    fetch(LOG_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(logPayload),
    }).catch((err) => {
      console.error("Failed to send log to internal endpoint:", err);
    });
  }
}

// Headers to include from Vercel infrastructure (useful for debugging)
const VERCEL_HEADERS_TO_KEEP = new Set([
  "x-vercel-id",
  "x-vercel-deployment-url",
  "x-vercel-forwarded-for",
]);

export function serializeRequest(request: NextRequest, body: any) {
  const headers: { [key: string]: string } = {};
  request.headers.forEach((value, key) => {
    if (key === "authorization") {
      // Keep the auth scheme so the auth method is visible; redact the credential
      const spaceIdx = value.indexOf(" ");
      headers[key] =
        spaceIdx !== -1
          ? `${value.slice(0, spaceIdx)} [REDACTED]`
          : "[REDACTED]";
    } else if (!key.startsWith("vercel") || VERCEL_HEADERS_TO_KEEP.has(key)) {
      headers[key] = value;
    }
  });

  return {
    url: new URL(request.nextUrl.pathname + (request.nextUrl.search || ""), APP_HOST).toString(),
    method: request.method,
    headers: headers,
    ip: (request.headers.get("x-forwarded-for") ?? "127.0.0.1")
      .split(",")[0]
      .trim(),
    userAgent: request.headers.get("user-agent") || "unknown",
    body: body,
  };
}
