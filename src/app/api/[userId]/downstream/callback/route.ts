import { NextRequest, NextResponse } from "next/server";
import { DownstreamOidcService } from "@/lib/scim/services/downstreamOidcService";
import { UserService } from "@/lib/scim/services/userService";
import { ScimUser } from "@/lib/scim/models/scimSchemas";
import {
  exchangeCode, fetchUserinfo, getIssuerMetadata, safeEqual, verifyIdToken,
  type Check,
} from "@/lib/downstream-oidc/oidc";
import { clearTx, openTx, TX_COOKIE_NAME } from "@/lib/downstream-oidc/tx-cookie";

interface RouteParams { params: Promise<{ userId: string }> }

const RESULT_PAGE = "/scim/preview/downstream-login";

/**
 * Okta's Sign-in redirect URI target.
 *
 * DELIBERATELY PUBLIC — Okta redirects the browser here with no session. Safety
 * comes from the signed transaction cookie: without it, or with a mismatched
 * `state`, the request fails closed.
 *
 * Deliberately NOT wrapped in logExternalRequest. That helper writes request
 * bodies into scim_logs, and this flow handles an authorization `code`, a
 * `code_verifier`, a client secret and an access token. Nothing here is logged;
 * the recorded attempt row is the audit trail, and it holds decoded claims only.
 */
export async function GET(req: NextRequest, { params }: RouteParams) {
  const { userId } = await params;
  const url  = new URL(req.url);
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin;
  const svc  = new DownstreamOidcService();

  /** Record the outcome and bounce to the page, always clearing the cookie. */
  const finish = async (
    outcome: "success" | "error",
    data: {
      error?: string;
      initiatedBy?: "sp" | "idp";
      claims?: Record<string, unknown> | null;
      userinfo?: Record<string, unknown> | null;
      matchedScimUserId?: string | null;
    },
  ) => {
    let attemptId: string | null = null;
    try {
      attemptId = await svc.recordAttempt(userId, {
        outcome,
        error:             data.error ?? null,
        initiatedBy:       data.initiatedBy ?? "sp",
        idTokenClaims:     data.claims ?? null,
        userinfo:          data.userinfo ?? null,
        matchedScimUserId: data.matchedScimUserId ?? null,
      });
    } catch {
      // If persistence fails the operator still deserves to land somewhere useful.
    }

    const to = new URL(`${base}${RESULT_PAGE}`);
    if (attemptId) to.searchParams.set("attempt", attemptId);
    else to.searchParams.set("error", data.error ?? "Unknown error");

    const res = NextResponse.redirect(to.toString());
    clearTx(res);
    return res;
  };

  // ── 1. Transaction cookie ──────────────────────────────────────────────────
  const tx = await openTx(req.cookies.get(TX_COOKIE_NAME)?.value);
  if (!tx) {
    return finish("error", {
      error: "No valid login transaction. The cookie is missing or expired — start the test again. "
           + "If this was an Okta-initiated login, it may have taken longer than 10 minutes.",
    });
  }
  if (tx.tenantId !== userId) {
    return finish("error", { error: "Transaction belongs to a different tenant.", initiatedBy: tx.initiatedBy });
  }

  // ── 2. Okta-reported error ─────────────────────────────────────────────────
  const oktaError = url.searchParams.get("error");
  if (oktaError) {
    const desc = (url.searchParams.get("error_description") ?? "").slice(0, 500);
    return finish("error", { error: `Okta returned "${oktaError}": ${desc}`, initiatedBy: tx.initiatedBy });
  }

  // ── 3. State ───────────────────────────────────────────────────────────────
  const state = url.searchParams.get("state") ?? "";
  if (!safeEqual(state, tx.state)) {
    return finish("error", {
      error: "state did not match the value issued for this login — possible CSRF, or a replayed callback.",
      initiatedBy: tx.initiatedBy,
    });
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return finish("error", { error: "Okta did not return an authorization code.", initiatedBy: tx.initiatedBy });
  }

  // ── 4. Config + endpoints ──────────────────────────────────────────────────
  const config = await svc.getConfigWithSecret(userId);
  if (!config) {
    return finish("error", { error: "Downstream OIDC config disappeared mid-flow.", initiatedBy: tx.initiatedBy });
  }

  let meta;
  try {
    meta = await getIssuerMetadata(config.issuer);
  } catch (err) {
    return finish("error", { error: `Issuer discovery failed: ${(err as Error).message}`, initiatedBy: tx.initiatedBy });
  }

  // ── 5. Token exchange ──────────────────────────────────────────────────────
  const redirectUri = `${base}/api/${userId}/downstream/callback`;
  let tokens;
  try {
    tokens = await exchangeCode({
      meta,
      clientId:     config.clientId,
      clientSecret: config.clientSecret,
      code,
      redirectUri,
      verifier:     tx.verifier,
    });
  } catch (err) {
    return finish("error", { error: `Token request failed: ${(err as Error).message}`, initiatedBy: tx.initiatedBy });
  }

  if (tokens.error || !tokens.id_token) {
    const detail = tokens.error
      ? `${tokens.error}: ${(tokens.error_description ?? "").slice(0, 500)}`
      : "response contained no id_token — check that the 'openid' scope is granted";
    return finish("error", { error: `Token exchange rejected — ${detail}`, initiatedBy: tx.initiatedBy });
  }

  // ── 6. Verify the ID token ─────────────────────────────────────────────────
  const verdict = await verifyIdToken({
    idToken:       tokens.id_token,
    meta,
    clientId:      config.clientId,
    expectedNonce: tx.nonce,
  });

  if (!verdict.ok || !verdict.claims) {
    const failed = verdict.checks.filter((c: Check) => c.outcome === "fail").map((c) => c.detail);
    return finish("error", {
      error: `ID token validation failed — ${failed.join("; ")}`,
      initiatedBy: tx.initiatedBy,
      claims: (verdict.claims ?? null) as Record<string, unknown> | null,
    });
  }

  const claims = verdict.claims as Record<string, unknown>;

  // ── 7. Userinfo (best effort) ──────────────────────────────────────────────
  const userinfo = tokens.access_token
    ? await fetchUserinfo(meta, tokens.access_token)
    : null;

  // ── 8. Resolve the SCIM record ─────────────────────────────────────────────
  // externalId first: Okta's SCIM externalId and the OIDC `sub` are both the Okta
  // user id, so a match there is the healthy case. Username and email are
  // fallbacks precisely because the OIDC app and the SCIM app can map them
  // differently — which is one of the mismatches this tool exists to surface.
  const users = new UserService();
  const sub   = typeof claims.sub === "string" ? claims.sub : null;
  const uname = typeof claims.preferred_username === "string" ? claims.preferred_username : null;
  const email = typeof claims.email === "string" ? claims.email : null;

  let matched: ScimUser | null = null;
  try {
    if (sub) matched = await users.getUserByExternalId(userId, sub);
    if (!matched && uname) {
      const { users: found } = await users.getUsers(1, 2, userId, null, uname);
      if (found.length === 1) matched = found[0];
    }
    if (!matched && email) {
      const { users: found } = await users.getUsers(1, 2, userId, null, email);
      if (found.length === 1) matched = found[0];
    }
  } catch {
    // A lookup failure should not discard a successful login — the claims are
    // still worth showing, and the page reports "no SCIM match".
  }

  return finish("success", {
    initiatedBy:       tx.initiatedBy,
    claims,
    userinfo,
    matchedScimUserId: matched?.id ?? null,
  });
}
