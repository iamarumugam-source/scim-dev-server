import { NextRequest, NextResponse } from "next/server";
import { protectWithApiKey } from "@/lib/scim/apiHelper";
import { createKeyPair, normalizeOrgUrl, oktaAdmin } from "@/lib/network-zones";
import { ID_RE, toStringList } from "@/lib/service-app";

type Step = { step: string; ok: boolean; status?: number; detail?: unknown };

export async function POST(request: NextRequest) {
  const unauthorized = await protectWithApiKey(request);
  if (unauthorized) return unauthorized;

  const b = await request.json().catch(() => ({}));
  const orgUrl = normalizeOrgUrl(b.orgUrl);
  if (!orgUrl || typeof b.apiKey !== "string" || !b.apiKey) {
    return NextResponse.json({ error: "A valid https org URL and API key are required." }, { status: 400 });
  }
  const apiKey: string = b.apiKey;
  const scopes = toStringList(b.scopes);
  const permissions = toStringList(b.permissions);
  const groupIds = toStringList(b.groupIds).filter((x) => ID_RE.test(x));
  const appIds = toStringList(b.appIds).filter((x) => ID_RE.test(x));
  const roleMode: "none" | "custom" | "standard" = b.roleMode === "custom" || b.roleMode === "standard" ? b.roleMode : "none";
  const standardType = typeof b.standardRole === "string" && /^[A-Z_]+$/.test(b.standardRole) ? b.standardRole : "";

  if (roleMode === "custom" && (!permissions.length || !(groupIds.length + appIds.length))) {
    return NextResponse.json({ error: "A custom role needs at least one permission and one group or app." }, { status: 400 });
  }
  if (roleMode === "standard" && !standardType) {
    return NextResponse.json({ error: "Choose a standard role type." }, { status: 400 });
  }

  const label = typeof b.label === "string" && b.label ? b.label : `Service app test ${new Date().toISOString()}`;
  const steps: Step[] = [];
  const record = (step: string, r: { ok: boolean; status: number; body: unknown }) =>
    steps.push({ step, ok: r.ok, status: r.status, detail: r.ok ? undefined : r.body });

  const { kid, publicJwk, privatePem } = await createKeyPair();
  const app = await oktaAdmin(orgUrl, apiKey, "/api/v1/apps", {
    method: "POST",
    body: JSON.stringify({
      name: "oidc_client",
      label,
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

  for (const scopeId of scopes) {
    record(`grant ${scopeId}`, await oktaAdmin(orgUrl, apiKey, `/api/v1/apps/${appBody.id}/grants`, {
      method: "POST",
      body: JSON.stringify({ issuer: orgUrl, scopeId }),
    }));
  }

  let customRoleId: string | undefined;
  let resourceSetId: string | undefined;

  if (roleMode === "custom") {
    const rs = await oktaAdmin(orgUrl, apiKey, "/api/v1/iam/resource-sets", {
      method: "POST",
      body: JSON.stringify({
        label: `${label} resources`.slice(0, 255),
        description: "Created by SCIM dev server service app tester",
        resources: [
          ...groupIds.map((id) => `${orgUrl}/api/v1/groups/${id}`),
          ...appIds.map((id) => `${orgUrl}/api/v1/apps/${id}`),
        ],
      }),
    });
    record("create resource set", rs);
    resourceSetId = (rs.body as { id?: string } | null)?.id;

    const role = await oktaAdmin(orgUrl, apiKey, "/api/v1/iam/roles", {
      method: "POST",
      body: JSON.stringify({
        label: `${label} role`.slice(0, 255),
        description: "Created by SCIM dev server service app tester",
        permissions,
      }),
    });
    record("create custom role", role);
    customRoleId = (role.body as { id?: string } | null)?.id;

    if (resourceSetId && customRoleId && clientId) {
      record("assign role to app", await oktaAdmin(orgUrl, apiKey, `/oauth2/v1/clients/${clientId}/roles`, {
        method: "POST",
        body: JSON.stringify({ type: "CUSTOM", role: customRoleId, "resource-set": resourceSetId }),
      }));
    }
  } else if (roleMode === "standard" && clientId) {
    const role = await oktaAdmin(orgUrl, apiKey, `/oauth2/v1/clients/${clientId}/roles`, {
      method: "POST",
      body: JSON.stringify({ type: standardType }),
    });
    record(`assign ${standardType}`, role);
    const roleId = (role.body as { id?: string } | null)?.id;
    if (roleId) {
      for (const gid of groupIds) {
        record(`target group ${gid}`, await oktaAdmin(orgUrl, apiKey,
          `/oauth2/v1/clients/${clientId}/roles/${roleId}/targets/groups/${gid}`, { method: "PUT" }));
      }
    }
  }

  return NextResponse.json({
    appId: appBody.id,
    clientId,
    kid,
    privateKeyPem: privatePem,
    scopes,
    customRoleId,
    resourceSetId,
    inScopeGroupIds: groupIds,
    inScopeAppIds: appIds,
    steps,
  });
}
