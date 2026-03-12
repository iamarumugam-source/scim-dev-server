import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: { userId: string };
}

const BASE_URL       = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const OKTA_ISSUER    = process.env.OKTA_ISSUER          ?? "";
const SIGNING_CLIENT = process.env.OKTA_SIGNING_CLIENT  ?? "";
const SIGNING_SECRET = process.env.OKTA_SIGNING_SECRET  ?? "";

function oauthError(error: string, description: string, status = 400): NextResponse {
  return NextResponse.json({ error, error_description: description }, { status });
}

// ─── Handler ──────────────────────────────────────────────────────────────────
//
// Receives the token request from the SCIM client after it has received the
// authorization code from the authorize endpoint.
//
// The SCIM client sends:
//   POST /api/{userId}/oauth2/token
//   Content-Type: application/x-www-form-urlencoded
//   grant_type=authorization_code&code=...&redirect_uri=...
//
// We exchange the code with the real Okta token endpoint using our signing
// credentials, substituting our own callback URL for redirect_uri (since that
// is what was registered with Okta in the authorize step).

export async function POST(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;

  if (!OKTA_ISSUER || !SIGNING_CLIENT || !SIGNING_SECRET) {
    return oauthError(
      "server_error",
      "OAuth middleware is not configured. Ensure OKTA_ISSUER, OKTA_SIGNING_CLIENT and OKTA_SIGNING_SECRET are set in .env.local.",
      503,
    );
  }

  // ── Parse request body ────────────────────────────────────────────────────
  // The SCIM client may send either application/x-www-form-urlencoded or JSON.

  let grantType = "";
  let code      = "";

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body = new URLSearchParams(await request.text());
    grantType  = body.get("grant_type") ?? "";
    code       = body.get("code")       ?? "";
  } else {
    const body = await request.json().catch(() => ({})) as Record<string, string>;
    grantType  = body.grant_type ?? "";
    code       = body.code       ?? "";
  }

  // ── Validate grant_type ───────────────────────────────────────────────────

  if (grantType !== "authorization_code") {
    return oauthError(
      "unsupported_grant_type",
      `grant_type "${grantType}" is not supported. Only "authorization_code" is accepted.`,
    );
  }

  if (!code) {
    return oauthError("invalid_request", "Missing required parameter: code.");
  }

  // ── Exchange code with Okta ───────────────────────────────────────────────
  //
  // The redirect_uri MUST match exactly what was used in the authorize request.
  // Since we substituted our own callback URL in the authorize step, we must
  // use the same URL here — not whatever the SCIM client sends.

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
    return oauthError(
      "server_error",
      `Could not reach Okta token endpoint: ${e.message}`,
      502,
    );
  }

  const tokenData = await oktaResponse.json();

  // Relay the Okta response (success or error) as-is to the SCIM client.
  return NextResponse.json(tokenData, { status: oktaResponse.status });
}
