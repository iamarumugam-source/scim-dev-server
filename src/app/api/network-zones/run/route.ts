import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { normalizeOrgUrl, signClientAssertion, tokenEndpoint, type AuthServerType } from "@/lib/network-zones";

const MAX_REQUESTS = 50;

export async function POST(request: NextRequest) {
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  const b = await request.json().catch(() => ({}));
  const orgUrl = normalizeOrgUrl(b.orgUrl);
  const type: AuthServerType = b.serverType === "custom" ? "custom" : "org";
  const count = Math.min(Math.max(parseInt(b.count, 10) || 1, 1), MAX_REQUESTS);
  if (!orgUrl || !b.clientId || !b.privateKeyPem || !b.kid) {
    return NextResponse.json({ error: "orgUrl, clientId, privateKeyPem and kid are required." }, { status: 400 });
  }
  const scope = typeof b.scope === "string" && b.scope ? b.scope : type === "org" ? "okta.users.read" : "";
  const endpoint = tokenEndpoint(orgUrl, type, b.serverId);

  const results = [];
  for (let i = 1; i <= count; i++) {
    const started = Date.now();
    try {
      const assertion = await signClientAssertion(b.clientId, endpoint, b.privateKeyPem, b.kid);
      const form = new URLSearchParams({
        grant_type: "client_credentials",
        client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
        client_assertion: assertion,
      });
      if (scope) form.set("scope", scope);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: form,
        cache: "no-store",
      });
      const text = await res.text();
      let body: Record<string, unknown> | string = text;
      try { body = JSON.parse(text); } catch { /* keep raw text */ }
      if (typeof body === "object" && typeof body.access_token === "string") {
        body = { ...body, access_token: `${body.access_token.slice(0, 12)}…(masked)` };
      }
      results.push({ index: i, status: res.status, ok: res.ok, ms: Date.now() - started, body, at: new Date().toISOString() });
    } catch (e) {
      results.push({ index: i, status: 0, ok: false, ms: Date.now() - started, body: { error: (e as Error).message }, at: new Date().toISOString() });
    }
  }
  return NextResponse.json({ endpoint, results });
}
