import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { normalizeOrgUrl, oktaAdmin } from "@/lib/network-zones";

export async function POST(request: NextRequest) {
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  const { orgUrl: rawOrg, apiKey } = await request.json().catch(() => ({}));
  const orgUrl = normalizeOrgUrl(rawOrg);
  if (!orgUrl || typeof apiKey !== "string" || !apiKey) {
    return NextResponse.json({ error: "A valid https org URL and API key are required." }, { status: 400 });
  }

  const [groups, apps] = await Promise.all([
    oktaAdmin(orgUrl, apiKey, "/api/v1/groups?limit=200"),
    oktaAdmin(orgUrl, apiKey, "/api/v1/apps?limit=200"),
  ]);
  if (!groups.ok || !apps.ok) {
    return NextResponse.json(
      { error: "Okta rejected resource listing", detail: !groups.ok ? groups.body : apps.body },
      { status: 502 }
    );
  }
  type G = { id: string; type?: string; profile?: { name?: string } };
  type A = { id: string; label?: string; name?: string; status?: string };
  return NextResponse.json({
    groups: (groups.body as G[]).map((g) => ({ id: g.id, name: g.profile?.name ?? g.id, type: g.type })),
    apps: (apps.body as A[]).map((a) => ({ id: a.id, label: a.label ?? a.name ?? a.id, status: a.status })),
  });
}
