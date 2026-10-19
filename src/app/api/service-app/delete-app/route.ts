import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { normalizeOrgUrl, oktaAdmin } from "@/lib/network-zones";
import { ID_RE } from "@/lib/service-app";

export async function POST(request: NextRequest) {
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  const b = await request.json().catch(() => ({}));
  const orgUrl = normalizeOrgUrl(b.orgUrl);
  const ok = (v: unknown) => typeof v === "string" && ID_RE.test(v);
  if (!orgUrl || typeof b.apiKey !== "string" || !b.apiKey || !ok(b.appId)) {
    return NextResponse.json({ error: "orgUrl, apiKey and a valid appId are required." }, { status: 400 });
  }

  await oktaAdmin(orgUrl, b.apiKey, `/api/v1/apps/${b.appId}/lifecycle/deactivate`, { method: "POST" });
  const del = await oktaAdmin(orgUrl, b.apiKey, `/api/v1/apps/${b.appId}`, { method: "DELETE" });
  if (!del.ok && del.status !== 404) {
    return NextResponse.json({ error: "Okta rejected app deletion", status: del.status, detail: del.body }, { status: 502 });
  }
  // Remove the role/resource set this tool created (best effort; they may already be gone).
  if (ok(b.customRoleId)) await oktaAdmin(orgUrl, b.apiKey, `/api/v1/iam/roles/${b.customRoleId}`, { method: "DELETE" });
  if (ok(b.resourceSetId)) await oktaAdmin(orgUrl, b.apiKey, `/api/v1/iam/resource-sets/${b.resourceSetId}`, { method: "DELETE" });
  return NextResponse.json({ deleted: true });
}
