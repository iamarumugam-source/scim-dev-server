import { NextRequest, NextResponse } from "next/server";

const APP_HOST = process.env.NEXT_PUBLIC_BASE_URL!;

function getLogApiUrl(userId: string) {
  return `${APP_HOST}/api/${userId}/scim/v2/logs`;
}

function isExternalRequest(request: NextRequest): boolean {
  console.log(request);
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
  userId: string
): Promise<void> {
  const LOG_API_URL = getLogApiUrl(userId);

  let payload: any;
  if (
    request.method === "POST" ||
    request.method === "PUT" ||
    request.method === "PATCH"
  ) {
    // console.log(request.clone().json())
    try {
      payload = await request.json();
    } catch (error) {
      payload = { error: "Could not parse request body as JSON." };
      console.log(error);
    }
  }
  if (isExternalRequest(request)) {
    // console.log(response)
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

export function serializeRequest(request: NextRequest, body: any) {
  const headers: { [key: string]: string } = {};
  request.headers.forEach((value, key) => {
    // Remove all headers related to Vercel
    if (!key.includes("vercel") && !key.includes("authorization"))
      headers[key] = value;
  });

  return {
    url: request.url,
    method: request.method,
    headers: headers,
    ip: (request.headers.get("x-forwarded-for") ?? "127.0.0.1")
      .split(",")[0]
      .trim(),
    userAgent: request.headers.get("user-agent") || "unknown",
    body: body,
  };
}
