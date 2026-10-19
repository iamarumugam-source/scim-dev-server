import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { normalizeOrgUrl } from "@/lib/network-zones";
import { getClientToken, safeApiPath, toStringList } from "@/lib/service-app";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export async function POST(request: NextRequest) {
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  const b = await request.json().catch(() => ({}));
  const orgUrl = normalizeOrgUrl(b.orgUrl);
  const path = safeApiPath(b.path);
  const method = typeof b.method === "string" ? b.method.toUpperCase() : "GET";
  if (!orgUrl || !b.clientId || !b.privateKeyPem || !b.kid) {
    return NextResponse.json({ error: "orgUrl, clientId, privateKeyPem and kid are required." }, { status: 400 });
  }
  if (!path) return NextResponse.json({ error: "Path must start with /api/v1/." }, { status: 400 });
  if (!METHODS.includes(method)) return NextResponse.json({ error: "Unsupported method." }, { status: 400 });

  const token = await getClientToken({
    orgUrl, clientId: b.clientId, kid: b.kid, privateKeyPem: b.privateKeyPem, scopes: toStringList(b.scopes),
  }).catch((e: Error) => ({ ok: false, status: 0, body: { error: e.message } as Record<string, unknown> }));

  if (!token.ok || typeof token.body.access_token !== "string") {
    return NextResponse.json({ stage: "token", status: token.status, body: token.body });
  }

  const started = Date.now();
  const res = await fetch(`${orgUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token.body.access_token}`,
    },
    body: method !== "GET" && method !== "DELETE" && typeof b.body === "string" && b.body.trim() ? b.body : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = text;
  try { body = text ? JSON.parse(text) : null; } catch { /* raw text */ }

  return NextResponse.json({
    stage: "api",
    status: res.status,
    ok: res.ok,
    ms: Date.now() - started,
    grantedScope: token.body.scope,
    body,
  });
}
