import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { createKeyPair, normalizeOrgUrl, oktaAdmin } from "@/lib/network-zones";

export async function POST(request: NextRequest) {
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  const { orgUrl: rawOrg, apiKey, label } = await request.json().catch(() => ({}));
  const orgUrl = normalizeOrgUrl(rawOrg);
  if (!orgUrl || typeof apiKey !== "string" || !apiKey) {
    return NextResponse.json({ error: "A valid https org URL and API key are required." }, { status: 400 });
  }

  const { kid, publicJwk, privatePem } = await createKeyPair();
  const app = await oktaAdmin(orgUrl, apiKey, "/api/v1/apps", {
    method: "POST",
    body: JSON.stringify({
      name: "oidc_client",
      label: typeof label === "string" && label ? label : `Network zone test ${new Date().toISOString()}`,
      signOnMode: "OPENID_CONNECT",
      credentials: { oauthClient: { token_endpoint_auth_method: "private_key_jwt" } },
      settings: {
        oauthClient: {
          application_type: "service",
          grant_types: ["client_credentials"],
          response_types: ["token"],
          jwks: { keys: [publicJwk] },
        },
      },
    }),
  });
  if (!app.ok) {
    return NextResponse.json({ error: "Okta rejected app creation", status: app.status, detail: app.body }, { status: 502 });
  }

  const appBody = app.body as { id: string; credentials?: { oauthClient?: { client_id?: string } } };
  const clientId = appBody.credentials?.oauthClient?.client_id;

  // Grant for the org authorization server. Harmless to attempt; failure is reported, not fatal.
  const grant = await oktaAdmin(orgUrl, apiKey, `/api/v1/apps/${appBody.id}/grants`, {
    method: "POST",
    body: JSON.stringify({ issuer: orgUrl, scopeId: "okta.users.read" }),
  });

  return NextResponse.json({
    appId: appBody.id,
    clientId,
    kid,
    privateKeyPem: privatePem,
    orgGrant: { ok: grant.ok, status: grant.status, detail: grant.ok ? undefined : grant.body },
  });
}
