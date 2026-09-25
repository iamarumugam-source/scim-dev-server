import { NextRequest, NextResponse } from "next/server";
import { DownstreamOidcService } from "@/lib/scim/services/downstreamOidcService";
import {
  authorizeUrl, challengeFor, getIssuerMetadata, normaliseIssuer, randomUrlSafe,
} from "@/lib/downstream-oidc/oidc";
import { attachTx, sealTx } from "@/lib/downstream-oidc/tx-cookie";

interface RouteParams { params: Promise<{ userId: string }> }

/**
 * The single entry point for BOTH directions of the login test.
 *
 * For OIDC — unlike SAML — Okta's IdP-initiated flow sends no unsolicited
 * assertion. Clicking the app tile redirects the browser to the app's configured
 * *Initiate login URI* with `iss` (and optionally `login_hint`), and the app then
 * builds its own authorization request. So this one URL serves as both that
 * Initiate login URI and our own "Test login" button target.
 *
 * DELIBERATELY PUBLIC. Okta must be able to reach it with no session, which is
 * inherent to initiate_login_uri. That is safe here because it only ever redirects
 * to the *stored* issuer's discovered authorization endpoint — never to anything
 * taken from the query string — and it returns to a fixed internal path.
 *
 * Deliberately NOT wrapped in logExternalRequest.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const url  = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin;

  const svc    = new DownstreamOidcService();
  const config = await svc.getConfig(userId);

  const fail = (msg: string, status = 400) =>
    NextResponse.json(
      { detail: msg, hint: `Configure the downstream app at ${base}/scim/preview/downstream-login` },
      { status },
    );

  if (!config?.issuer || !config.clientId) {
    return fail("No downstream OIDC app is configured for this tenant.");
  }

  // `iss` present means Okta initiated this. Validate it against the stored issuer
  // rather than trusting it — validating is the entire security value of the
  // parameter, and the authorize URL is still built from the stored value.
  const iss         = url.searchParams.get("iss");
  const initiatedBy = iss ? "idp" : "sp";
  if (iss && normaliseIssuer(iss) !== normaliseIssuer(config.issuer)) {
    return fail(
      `Okta initiated login from issuer "${iss}", which does not match the configured issuer "${config.issuer}".`,
    );
  }

  let meta;
  try {
    meta = await getIssuerMetadata(config.issuer);
  } catch (err) {
    return fail(`Could not resolve the issuer's endpoints: ${(err as Error).message}`, 502);
  }

  const state    = randomUrlSafe();
  const nonce    = randomUrlSafe();
  const verifier = randomUrlSafe();
  const challenge = await challengeFor(verifier);

  // Derived from NEXT_PUBLIC_BASE_URL, never from a query parameter, and must match
  // the Sign-in redirect URI registered in Okta byte for byte.
  const redirectUri = `${base}/api/${userId}/downstream/callback`;

  const target = authorizeUrl({
    meta,
    clientId:  config.clientId,
    redirectUri,
    scopes:    config.scopes,
    state,
    nonce,
    challenge,
    loginHint: url.searchParams.get("login_hint"),
  });

  const res = NextResponse.redirect(target);
  attachTx(res, await sealTx({ tenantId: userId, state, nonce, verifier, initiatedBy }));
  return res;
}
