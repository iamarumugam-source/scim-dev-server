import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import crypto from "crypto";
import { logExternalRequest } from "@/lib/scim/logging";

const BASE_URL        = process.env.NEXT_PUBLIC_BASE_URL   ?? "http://localhost:3000";
const OKTA_ISSUER     = process.env.OKTA_ISSUER            ?? "";
const SIGNING_CLIENT  = process.env.OKTA_SIGNING_CLIENT    ?? "";
const SIGNING_SECRET  = process.env.OKTA_SIGNING_SECRET    ?? "";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET        ?? "";

function oauthError(
  request: NextRequest, userId: string,
  error: string, description: string, status = 400,
): NextResponse {
  const data     = { error, error_description: description };
  const response = NextResponse.json(data, { status });
  if (userId) logExternalRequest(request, response, data, userId);
  return response;
}

// ─── Shared callback URL ──────────────────────────────────────────────────────
//
// Must match exactly what was used in the authorize step.

const OUR_CALLBACK = `${BASE_URL}/api/oauth2/authorize`;

// ─── Client credentials helpers ──────────────────────────────────────────────

/** Derives the expected client_secret as SHA-256(clientId + ":scim-oauth-secret").hex[:32] */
function deriveExpectedSecret(clientId: string): Buffer {
  const hex = crypto
    .createHash("sha256")
    .update(clientId + ":scim-oauth-secret")
    .digest("hex")
    .slice(0, 32);
  return Buffer.from(hex, "utf-8");
}

async function handleClientCredentials(
  request: NextRequest,
  clientId: string,
  clientSecret: string,
): Promise<NextResponse> {
  if (!clientId || !clientSecret) {
    return oauthError(request, clientId, "invalid_request", "Missing client_id or client_secret.");
  }

  if (!NEXTAUTH_SECRET) {
    return oauthError(request, clientId, "server_error", "Token signing is not configured.", 503);
  }

  const expected = deriveExpectedSecret(clientId);
  const provided = Buffer.from(clientSecret, "utf-8");

  // Constant-time comparison — timingSafeEqual requires equal-length buffers.
  const valid =
    expected.length === provided.length &&
    crypto.timingSafeEqual(expected, provided);

  if (!valid) {
    return oauthError(request, clientId, "invalid_client", "client_id or client_secret is invalid.", 401);
  }

  const now        = Math.floor(Date.now() / 1000);
  const signingKey = new TextEncoder().encode(NEXTAUTH_SECRET);

  const accessToken = await new SignJWT({ scope: "scim" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(clientId)
    .setIssuer(BASE_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(signingKey);

  const safeData = { token_type: "Bearer", expires_in: 3600 };
  const response = NextResponse.json({ access_token: accessToken, ...safeData });
  logExternalRequest(request, response, safeData, clientId);
  return response;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
//
// Supports two grant types:
//   • client_credentials — validated locally, no Okta required
//   • authorization_code — proxied to Okta (existing behaviour)

export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Parse request body ────────────────────────────────────────────────────

  let grantType    = "";
  let code         = "";
  let bodyClientId = "";
  let bodySecret   = "";

  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const body   = new URLSearchParams(await request.clone().text());
    grantType    = body.get("grant_type")    ?? "";
    code         = body.get("code")          ?? "";
    bodyClientId = body.get("client_id")     ?? "";
    bodySecret   = body.get("client_secret") ?? "";
  } else {
    const body   = await request.clone().json().catch(() => ({})) as Record<string, string>;
    grantType    = body.grant_type    ?? "";
    code         = body.code          ?? "";
    bodyClientId = body.client_id     ?? "";
    bodySecret   = body.client_secret ?? "";
  }

  // ── HTTP Basic auth (RFC 6749 §2.3.1) ────────────────────────────────────
  // Body params take precedence; Basic header is a fallback.

  let clientId     = bodyClientId;
  let clientSecret = bodySecret;

  const authHeader = request.headers.get("Authorization") ?? "";
  if (!clientId && authHeader.startsWith("Basic ")) {
    const decoded  = Buffer.from(authHeader.slice(6), "base64").toString("utf-8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx !== -1) {
      clientId     = decoded.slice(0, colonIdx);
      clientSecret = decoded.slice(colonIdx + 1);
    }
  }

  // ── client_credentials grant (local, no Okta required) ───────────────────

  if (grantType === "client_credentials") {
    return handleClientCredentials(request, clientId, clientSecret);
  }

  // ── authorization_code grant (requires Okta) ─────────────────────────────

  if (!OKTA_ISSUER || !SIGNING_CLIENT || !SIGNING_SECRET) {
    return oauthError(
      request, clientId,
      "server_error",
      "OAuth middleware is not configured. Ensure OKTA_ISSUER, OKTA_SIGNING_CLIENT and OKTA_SIGNING_SECRET are set in .env.local.",
      503,
    );
  }

  if (grantType !== "authorization_code") {
    return oauthError(
      request, clientId,
      "unsupported_grant_type",
      `grant_type "${grantType}" is not supported. Use "client_credentials" or "authorization_code".`,
    );
  }

  if (!code) {
    return oauthError(request, clientId, "invalid_request", "Missing required parameter: code.");
  }

  // ── Exchange code with Okta ───────────────────────────────────────────────

  const credentials = Buffer.from(`${SIGNING_CLIENT}:${SIGNING_SECRET}`).toString("base64");

  const tokenBody = new URLSearchParams({
    grant_type:   "authorization_code",
    code,
    redirect_uri: OUR_CALLBACK,
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
      request, clientId,
      "server_error",
      `Could not reach Okta token endpoint: ${e.message}`,
      502,
    );
  }

  const tokenData = await oktaResponse.json();
  const response  = NextResponse.json(tokenData, { status: oktaResponse.status });

  if (clientId) {
    const { access_token: _stripped, ...safeTokenData } = tokenData as any;
    logExternalRequest(request, response, safeTokenData, clientId);
  }

  return response;
}
