import { NextRequest, NextResponse } from "next/server";
import { CimdService } from "@/lib/scim/services/cimdService";

interface RouteParams { params: Promise<{ userId: string }> }

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL ?? "";

/**
 * PUBLIC — the Client ID Metadata Document itself.
 *
 * This URL IS the client_id. Okta dereferences it to fetch the client's metadata.
 * The response matches the RFC example shape exactly:
 *   client_id, client_name, client_uri, logo_uri, redirect_uris, grant_types,
 *   response_types, token_endpoint_auth_method, jwks/jwks_uri, scope,
 *   policy_uri, tos_uri.
 *
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

  const redirectUris = config?.redirectUris?.length
    ? config.redirectUris
    : ["http://localhost:3000/callback", "http://localhost:8080/callback"];

  const grantTypes = config?.grantTypes?.length
    ? config.grantTypes
    : ["authorization_code"];

  // Build the document in the exact RFC example order.
  const doc: Record<string, unknown> = {
    client_id:                  clientIdUrl,
    client_name:                config?.clientName ?? "SCIM Dev Server — CIMD test",
  };

  // Optional top-level URIs — only present when configured (no empty strings).
  if (config?.clientUri) doc.client_uri = config.clientUri;
  if (config?.logoUri)   doc.logo_uri   = config.logoUri;

  doc.redirect_uris              = redirectUris;
  doc.grant_types                = grantTypes;
  doc.response_types             = ["code"];
  doc.token_endpoint_auth_method = config?.authMethod ?? "none";

  // Key material — jwks (inline) or jwks_uri (remote), never both.
  if (config?.jwksUri)      doc.jwks_uri = config.jwksUri;
  else if (config?.jwks)    doc.jwks     = config.jwks;

  doc.scope = config?.scopes ?? "openid profile email";

  if (config?.policyUri)  doc.policy_uri = config.policyUri;
  if (config?.tosUri)     doc.tos_uri    = config.tosUri;

  // Record the fetch (fire-and-forget — a logging failure must not break the doc).
  const ua = req.headers.get("user-agent");
  const ip = (req.headers.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim();
  svc.recordFetch(userId, ua, ip).catch(() => {});

  return NextResponse.json(doc, {
    status:  200,
    headers: {
      "Content-Type":  "application/json",
      "Cache-Control": "no-store",
    },
  });
}
