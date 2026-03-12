import { NextRequest, NextResponse } from "next/server";

interface RouteParams {
  params: { userId: string };
}

const BASE_URL       = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const OKTA_ISSUER    = process.env.OKTA_ISSUER          ?? "";
const SIGNING_CLIENT = process.env.OKTA_SIGNING_CLIENT  ?? "";

// ─── State encoding ───────────────────────────────────────────────────────────
//
// We pack the SCIM client's original redirect_uri + state into a single
// base64url string so we can recover them when Okta redirects back to us.

function encodeRelayState(payload: { redirect_uri: string; state: string }): string {
  const b64 = Buffer.from(JSON.stringify(payload)).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function decodeRelayState(encoded: string): { redirect_uri: string; state: string } | null {
  try {
    const b64    = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    return JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

function oauthError(error: string, description: string, status = 400): NextResponse {
  return NextResponse.json({ error, error_description: description }, { status });
}

// ─── Handler ──────────────────────────────────────────────────────────────────
//
// This endpoint serves as an OAuth 2.0 authorization middleware between a SCIM
// client (e.g. Okta's SCIM provisioner) and the real Okta authorization server.
//
// Phase 1 — client initiates:
//   SCIM client → GET /api/{userId}/oauth2/authorize?response_type=code&client_id=...&redirect_uri=...&state=...
//   We forward the request to the real Okta authorization server, substituting
//   our own callback URL as redirect_uri and encoding the client's redirect_uri
//   + state in our state parameter.
//
// Phase 2 — Okta callback:
//   Okta → GET /api/{userId}/oauth2/authorize?code=...&state=<relay>
//   We decode the relay state to recover the client's redirect_uri and state,
//   then redirect the authorization code back to the SCIM client.

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const sp         = request.nextUrl.searchParams;

  if (!OKTA_ISSUER || !SIGNING_CLIENT) {
    return oauthError(
      "server_error",
      "OAuth middleware is not configured. Ensure OKTA_ISSUER and OKTA_SIGNING_CLIENT are set in .env.local.",
      503,
    );
  }

  // ── Phase 1: Initial request from the SCIM client ─────────────────────────

  if (sp.has("response_type") && sp.has("client_id") && sp.has("redirect_uri")) {
    const responseType      = sp.get("response_type")!;
    const clientRedirectUri = sp.get("redirect_uri")!;
    const clientState       = sp.get("state") ?? "";

    if (responseType !== "code") {
      return oauthError(
        "unsupported_response_type",
        `response_type "${responseType}" is not supported. Only "code" is accepted.`,
      );
    }

    // Our server's callback — this is where Okta will redirect back after auth.
    const ourCallback = `${BASE_URL}/api/${userId}/oauth2/authorize`;

    // Encode the client's redirect_uri and state so we can restore them in Phase 2.
    const relayState = encodeRelayState({ redirect_uri: clientRedirectUri, state: clientState });

    const oktaUrl = new URL(`${OKTA_ISSUER}/v1/authorize`);
    oktaUrl.searchParams.set("client_id",     SIGNING_CLIENT);
    oktaUrl.searchParams.set("response_type", "code");
    oktaUrl.searchParams.set("scope",         "openid");
    oktaUrl.searchParams.set("redirect_uri",  ourCallback);
    oktaUrl.searchParams.set("state",         relayState);

    return NextResponse.redirect(oktaUrl.toString(), { status: 302 });
  }

  // ── Phase 2a: Okta returned an error ──────────────────────────────────────

  if (sp.has("error") && sp.has("state")) {
    const error       = sp.get("error")!;
    const description = sp.get("error_description") ?? "";
    const relay       = decodeRelayState(sp.get("state")!);

    if (!relay?.redirect_uri) {
      return oauthError("invalid_state", "Cannot relay error: redirect_uri missing from state.");
    }

    const dest = new URL(relay.redirect_uri);
    dest.searchParams.set("error", error);
    if (description)  dest.searchParams.set("error_description", description);
    if (relay.state)  dest.searchParams.set("state", relay.state);

    return NextResponse.redirect(dest.toString(), { status: 302 });
  }

  // ── Phase 2b: Okta returned a success code ────────────────────────────────

  if (sp.has("code") && sp.has("state")) {
    const code  = sp.get("code")!;
    const relay = decodeRelayState(sp.get("state")!);

    if (!relay?.redirect_uri) {
      return oauthError("invalid_state", "Cannot relay code: redirect_uri missing from state.");
    }

    const dest = new URL(relay.redirect_uri);
    dest.searchParams.set("code", code);
    if (relay.state) dest.searchParams.set("state", relay.state);

    return NextResponse.redirect(dest.toString(), { status: 302 });
  }

  return oauthError("invalid_request", "Missing required OAuth 2.0 parameters.");
}
