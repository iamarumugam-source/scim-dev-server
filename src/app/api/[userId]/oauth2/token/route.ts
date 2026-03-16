import { NextRequest, NextResponse } from "next/server";
import { logExternalRequest } from "@/lib/scim/logging";

interface RouteParams {
  params: { userId: string };
}

const BASE_URL       = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const OKTA_ISSUER    = process.env.OKTA_ISSUER          ?? "";
const SIGNING_CLIENT = process.env.OKTA_SIGNING_CLIENT  ?? "";
const SIGNING_SECRET = process.env.OKTA_SIGNING_SECRET  ?? "";

function oauthError(
  request: NextRequest, userId: string,
  error: string, description: string, status = 400,
): NextResponse {
  const data     = { error, error_description: description };
  const response = NextResponse.json(data, { status });
  logExternalRequest(request, response, data, userId);
  return response;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  if (!OKTA_ISSUER || !SIGNING_CLIENT || !SIGNING_SECRET) {
    return oauthError(request, userId,
      "server_error",
      "OAuth middleware is not configured. Ensure OKTA_ISSUER, OKTA_SIGNING_CLIENT and OKTA_SIGNING_SECRET are set in .env.local.",
      503,
    );
  }

  // ── Parse request body ────────────────────────────────────────────────────

  let grantType = "";
  let code      = "";

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = new URLSearchParams(await request.clone().text());
    grantType  = body.get("grant_type") ?? "";
    code       = body.get("code")       ?? "";
  } else {
    const body = await request.clone().json().catch(() => ({})) as Record<string, string>;
    grantType  = body.grant_type ?? "";
    code       = body.code       ?? "";
  }

  // ── Validate ──────────────────────────────────────────────────────────────

  if (grantType !== "authorization_code") {
    return oauthError(request, userId,
      "unsupported_grant_type",
      `grant_type "${grantType}" is not supported. Only "authorization_code" is accepted.`,
    );
  }

  if (!code) {
    return oauthError(request, userId, "invalid_request", "Missing required parameter: code.");
  }

  // ── Exchange code with Okta ───────────────────────────────────────────────

  const ourCallback = `${BASE_URL}/api/${userId}/oauth2/authorize`;
  const credentials = Buffer.from(`${SIGNING_CLIENT}:${SIGNING_SECRET}`).toString("base64");

  const tokenBody = new URLSearchParams({
    grant_type:   "authorization_code",
    code,
    redirect_uri: ourCallback,
  });

  let oktaResponse: Response;
  try {
    oktaResponse = await fetch(`${OKTA_ISSUER}/v1/token`, {
      method:  "POST",
      headers: {
        "Content-Type":  "application/x-www-form-urlencoded",
        "Accept":        "application/json",
        "Authorization": `Basic ${credentials}`,
      },
      body: tokenBody.toString(),
    });
  } catch (e: any) {
    return oauthError(request, userId,
      "server_error",
      `Could not reach Okta token endpoint: ${e.message}`,
      502,
    );
  }

  const tokenData = await oktaResponse.json();
  const response  = NextResponse.json(tokenData, { status: oktaResponse.status });

  // Log with token_type and expiry but strip the actual access_token for security
  const { access_token: _stripped, ...safeTokenData } = tokenData as any;
  logExternalRequest(request, response, safeTokenData, userId);

  return response;
}
