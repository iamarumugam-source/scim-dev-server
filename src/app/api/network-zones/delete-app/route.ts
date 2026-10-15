import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { normalizeOrgUrl, oktaAdmin } from "@/lib/network-zones";

export async function POST(request: NextRequest) {
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  const { orgUrl: rawOrg, apiKey, appId } = await request.json().catch(() => ({}));
  const orgUrl = normalizeOrgUrl(rawOrg);
  if (!orgUrl || typeof apiKey !== "string" || !apiKey || typeof appId !== "string" || !/^[\w-]+$/.test(appId)) {
    return NextResponse.json({ error: "orgUrl, apiKey and a valid appId are required." }, { status: 400 });
  }

  // Okta requires deactivation before deletion; an already-inactive app returns a benign result.
  await oktaAdmin(orgUrl, apiKey, `/api/v1/apps/${appId}/lifecycle/deactivate`, { method: "POST" });
  const del = await oktaAdmin(orgUrl, apiKey, `/api/v1/apps/${appId}`, { method: "DELETE" });
  if (!del.ok && del.status !== 404) {
    return NextResponse.json({ error: "Okta rejected app deletion", status: del.status, detail: del.body }, { status: 502 });
  }
  return NextResponse.json({ deleted: true });
}
