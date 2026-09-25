import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { DownstreamOidcService } from "@/lib/scim/services/downstreamOidcService";
import { getIssuerMetadata, normaliseIssuer } from "@/lib/downstream-oidc/oidc";

interface RouteParams { params: Promise<{ userId: string }> }

/**
 * Downstream OIDC app config.
 *
 * Session-gated with a tenant-ownership check — unlike `/api/[userId]/settings`,
 * which is deliberately open because Edge middleware self-fetches it. That is
 * precisely why this config lives in its own table and route: a client secret must
 * not sit behind an unauthenticated endpoint.
 *
 * Deliberately NOT wrapped in logExternalRequest: that helper writes request
 * bodies into scim_logs, and a PUT here carries a client secret.
 */
async function requireTenant(userId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || (session.user as { id?: string }).id !== userId) return false;
  return true;
}

/** GET — never returns the secret, only `hasSecret`. */
export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  if (!(await requireTenant(userId))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  const svc = new DownstreamOidcService();
  const config = await svc.getConfig(userId);

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? "";
  return NextResponse.json({
    config,
    // The operator cannot guess these, and a mistyped redirect URI is the most
    // common way this feature fails — so the server states them authoritatively.
    redirectUri:      `${base}/api/${userId}/downstream/callback`,
    initiateLoginUri: `${base}/api/${userId}/downstream/login`,
  });
}

/** PUT — an omitted/empty clientSecret leaves any stored value untouched. */
export async function PUT(req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  if (!(await requireTenant(userId))) {
    return NextResponse.json({ detail: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ detail: "Invalid JSON body." }, { status: 400 }); }

  const issuer   = normaliseIssuer(String(body.issuer ?? ""));
  const clientId = String(body.clientId ?? "").trim();
  const scopes   = String(body.scopes ?? "").trim();
  const secret   = body.clientSecret == null ? undefined : String(body.clientSecret);

  if (!issuer || !clientId) {
    return NextResponse.json({ detail: "issuer and clientId are required." }, { status: 400 });
  }
  if (!/^https:\/\//.test(issuer) && !issuer.startsWith("http://localhost")) {
    return NextResponse.json(
      { detail: "issuer must be an https URL (http is allowed only for localhost)." },
      { status: 400 },
    );
  }

  const svc = new DownstreamOidcService();
  try {
    const saved = await svc.saveConfig(userId, { issuer, clientId, scopes, clientSecret: secret });

    // Probe discovery so a typo surfaces here rather than as an opaque Okta error
    // after the first redirect. Non-fatal: the config is already saved.
    let discovery: { ok: boolean; authorizationEndpoint?: string; error?: string };
    try {
      const meta = await getIssuerMetadata(issuer);
      discovery = { ok: true, authorizationEndpoint: meta.authorization_endpoint };
    } catch (e) {
      discovery = { ok: false, error: (e as Error).message };
    }

    return NextResponse.json({ config: saved, discovery });
  } catch (err) {
    return NextResponse.json({ detail: (err as Error).message }, { status: 500 });
  }
}
