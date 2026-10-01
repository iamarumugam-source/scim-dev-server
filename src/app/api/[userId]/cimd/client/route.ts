import { NextRequest, NextResponse } from "next/server";
import { CimdService } from "@/lib/scim/services/cimdService";

interface RouteParams { params: Promise<{ userId: string }> }

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

/**
 * PUBLIC — the Client ID Metadata Document itself.
 *
 * This URL IS the client_id. Okta dereferences it to fetch the client's metadata.
 * Spec constraints (draft-ietf-oauth-client-id-metadata-document-02):
 *   - 200 OK; no redirects (AS MUST NOT follow them).
 *   - JSON body; the `client_id` field MUST equal this URL exactly.
 *   - No client_secret or shared-secret auth methods.
 *   - https in production (loopback exception for dev only).
 *
 * Each fetch is logged so the operator can confirm Okta actually dereferenced it.
 * Deliberately NOT behind protectWithApiKey — Okta fetches this without auth.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const clientIdUrl = `${BASE_URL}/api/${userId}/cimd/client`;

  const svc    = new CimdService();
  const config = await svc.getConfig(userId);

  // Default to localhost so the OAuth flow redirects to whatever local app the
  // operator is testing, rather than back to this server. Configurable from the
  // CIMD page — set redirect_uris there to change it.
  const redirectUris = config?.redirectUris?.length
    ? config.redirectUris
    : ["http://localhost:3000/callback", "http://localhost:8080/callback"];

  const doc = {
    client_id:                   clientIdUrl,
    client_name:                 config?.clientName ?? "SCIM Dev Server — CIMD test",
    redirect_uris:               redirectUris,
    grant_types:                 ["authorization_code"],
    response_types:              ["code"],
    scope:                       config?.scopes ?? "openid profile email",
    token_endpoint_auth_method:  config?.authMethod ?? "none",
    ...(config?.jwks ? { jwks: config.jwks } : {}),
    ...(config?.clientUri ? { client_uri: config.clientUri } : {}),
  };

  // Record the fetch (fire-and-forget — a logging failure must not break the doc).
  const ua = req.headers.get("user-agent");
  const ip = (req.headers.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim();
  svc.recordFetch(userId, ua, ip).catch(() => {});

  return NextResponse.json(doc, {
    status:  200,
    headers: {
      "Content-Type":  "application/json",
      "Cache-Control": "no-store",   // Okta should re-fetch, not cache a stale doc
    },
  });
}
