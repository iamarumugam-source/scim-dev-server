import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";
import { timingSafeEqual } from "crypto";

/**
 * OIDC relying-party helpers for the downstream login test.
 *
 * ── Why discovery, and not `${issuer}/v1/...` ────────────────────────────────
 * Okta issuers come in two shapes and the endpoint paths differ:
 *
 *   custom AS   issuer https://org.okta.com/oauth2/default
 *               authorize https://org.okta.com/oauth2/default/v1/authorize
 *   org AS      issuer https://org.okta.com
 *               authorize https://org.okta.com/oauth2/v1/authorize   ← note /oauth2
 *
 * Appending `/v1/authorize` to the issuer is therefore only correct for a custom
 * AS; for an org AS it yields `https://org.okta.com/v1/authorize`, which 404s.
 * `src/app/api/oauth2/authorize/route.ts` has exactly that bug today. Operators
 * paste whichever issuer they have, so the endpoints are read from the discovery
 * document instead of guessed.
 *
 * ── Why a new ID-token verifier ──────────────────────────────────────────────
 * The one in `apiHelper.ts` is module-private, returns a boolean that discards the
 * payload, and checks neither `aud` nor `nonce`. Adequate for a bearer access
 * token; unsafe for an ID token, where a missing `aud` check accepts tokens minted
 * for another client and a missing `nonce` check accepts a replayed one.
 */

// ─── Discovery ────────────────────────────────────────────────────────────────

export interface IssuerMetadata {
  issuer:                 string;
  authorization_endpoint: string;
  token_endpoint:         string;
  userinfo_endpoint?:     string;
  jwks_uri:               string;
}

interface CacheEntry { meta: IssuerMetadata; at: number }
const metaCache = new Map<string, CacheEntry>();
const META_TTL  = 10 * 60 * 1000;

/** Trailing slashes break exact `iss` comparison, so normalise once, centrally. */
export function normaliseIssuer(issuer: string): string {
  return issuer.trim().replace(/\/+$/, "");
}

/**
 * Reads the discovery document. Falls back to the two conventional Okta layouts
 * so a reachable-but-undiscoverable issuer still works, and surfaces which path
 * was used so the UI can say so.
 */
export async function getIssuerMetadata(rawIssuer: string): Promise<IssuerMetadata> {
  const issuer = normaliseIssuer(rawIssuer);
  const hit = metaCache.get(issuer);
  if (hit && Date.now() - hit.at < META_TTL) return hit.meta;

  const url = `${issuer}/.well-known/openid-configuration`;
  let meta: IssuerMetadata;

  try {
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`discovery returned ${res.status}`);
    const doc = (await res.json()) as Partial<IssuerMetadata>;
    if (!doc.authorization_endpoint || !doc.token_endpoint || !doc.jwks_uri) {
      throw new Error("discovery document is missing required endpoints");
    }
    meta = {
      issuer:                 doc.issuer ?? issuer,
      authorization_endpoint: doc.authorization_endpoint,
      token_endpoint:         doc.token_endpoint,
      userinfo_endpoint:      doc.userinfo_endpoint,
      jwks_uri:               doc.jwks_uri,
    };
  } catch {
    // Fallback: an org-AS issuer has no /oauth2 segment, so its endpoints sit
    // under /oauth2/v1. A custom-AS issuer already ends in /oauth2/<id>.
    const base = /\/oauth2(\/|$)/.test(issuer) ? issuer : `${issuer}/oauth2`;
    meta = {
      issuer,
      authorization_endpoint: `${base}/v1/authorize`,
      token_endpoint:         `${base}/v1/token`,
      userinfo_endpoint:      `${base}/v1/userinfo`,
      jwks_uri:               `${base}/v1/keys`,
    };
  }

  metaCache.set(issuer, { meta, at: Date.now() });
  return meta;
}

// ─── PKCE ─────────────────────────────────────────────────────────────────────

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomUrlSafe(bytes = 32): string {
  return b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

export async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return b64url(new Uint8Array(digest));
}

/** Constant-time compare for `state` and `nonce`. */
export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

// ─── Authorize URL ────────────────────────────────────────────────────────────

export function authorizeUrl(opts: {
  meta:        IssuerMetadata;
  clientId:    string;
  redirectUri: string;
  scopes:      string;
  state:       string;
  nonce:       string;
  challenge:   string;
  loginHint?:  string | null;
}): string {
  const u = new URL(opts.meta.authorization_endpoint);
  // openid is mandatory for an ID token; a mis-typed scope string should not
  // silently turn this into a plain OAuth flow with no id_token.
  const scopes = opts.scopes.split(/\s+/).filter(Boolean);
  if (!scopes.includes("openid")) scopes.unshift("openid");

  u.searchParams.set("client_id",             opts.clientId);
  u.searchParams.set("response_type",         "code");
  u.searchParams.set("scope",                 scopes.join(" "));
  u.searchParams.set("redirect_uri",          opts.redirectUri);
  u.searchParams.set("state",                 opts.state);
  u.searchParams.set("nonce",                 opts.nonce);
  u.searchParams.set("code_challenge",        opts.challenge);
  u.searchParams.set("code_challenge_method", "S256");
  if (opts.loginHint) u.searchParams.set("login_hint", opts.loginHint);
  return u.toString();
}

// ─── Token exchange ───────────────────────────────────────────────────────────

export interface TokenResponse {
  id_token?:          string;
  access_token?:      string;
  token_type?:        string;
  expires_in?:        number;
  scope?:             string;
  error?:             string;
  error_description?: string;
}

/**
 * PKCE always; `client_secret_basic` only when a secret is stored, so a public
 * SPA/native app and a confidential web app both work.
 */
export async function exchangeCode(opts: {
  meta:         IssuerMetadata;
  clientId:     string;
  clientSecret: string | null;
  code:         string;
  redirectUri:  string;
  verifier:     string;
}): Promise<TokenResponse> {
  const body = new URLSearchParams({
    grant_type:    "authorization_code",
    code:          opts.code,
    redirect_uri:  opts.redirectUri,
    code_verifier: opts.verifier,
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
    Accept:         "application/json",
  };

  if (opts.clientSecret) {
    headers.Authorization =
      "Basic " + Buffer.from(`${opts.clientId}:${opts.clientSecret}`).toString("base64");
  } else {
    // Public client: no Basic credential, so the id goes in the body.
    body.set("client_id", opts.clientId);
  }

  const res = await fetch(opts.meta.token_endpoint, { method: "POST", headers, body });
  return (await res.json()) as TokenResponse;
}

// ─── ID token verification ────────────────────────────────────────────────────

export interface Check {
  id:      string;
  label:   string;
  outcome: "pass" | "warn" | "fail";
  detail:  string;
}

const jwksCache = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function jwksFor(uri: string) {
  let f = jwksCache.get(uri);
  if (!f) { f = createRemoteJWKSet(new URL(uri)); jwksCache.set(uri, f); }
  return f;
}

/**
 * Returns granular checks rather than throwing. For a debugging tool, "which
 * check failed and why" is the product — an exception collapses that to one line.
 */
export async function verifyIdToken(opts: {
  idToken:       string;
  meta:          IssuerMetadata;
  clientId:      string;
  expectedNonce: string;
}): Promise<{ ok: boolean; claims: JWTPayload | null; checks: Check[] }> {
  const checks: Check[] = [];
  let claims: JWTPayload | null = null;

  try {
    const { payload } = await jwtVerify(opts.idToken, jwksFor(opts.meta.jwks_uri), {
      issuer:         normaliseIssuer(opts.meta.issuer),
      audience:       opts.clientId,
      clockTolerance: 60,
    });
    claims = payload;
    checks.push({
      id: "signature", label: "Signature, issuer, audience and expiry", outcome: "pass",
      detail: `Verified against ${opts.meta.jwks_uri}; aud = ${opts.clientId}`,
    });
  } catch (err) {
    checks.push({
      id: "signature", label: "Signature, issuer, audience and expiry", outcome: "fail",
      detail: (err as Error).message,
    });
    return { ok: false, claims: null, checks };
  }

  // jose has no notion of nonce — it is OIDC-specific. Without this, a token
  // captured from an earlier login could be replayed into a new one.
  const nonceOk = typeof claims.nonce === "string" && safeEqual(claims.nonce, opts.expectedNonce);
  checks.push({
    id: "nonce", label: "Nonce matches this login", outcome: nonceOk ? "pass" : "fail",
    detail: nonceOk
      ? "Matches the value issued when the flow started"
      : "Missing or mismatched — the token was not minted for this login attempt",
  });

  // When aud is an array, OIDC requires azp to name the client.
  if (Array.isArray(claims.aud)) {
    const azpOk = claims.azp === opts.clientId;
    checks.push({
      id: "azp", label: "azp present for multi-audience token", outcome: azpOk ? "pass" : "fail",
      detail: azpOk ? `azp = ${claims.azp}` : "aud is an array but azp does not name this client",
    });
  }

  const iat = typeof claims.iat === "number" ? claims.iat : null;
  if (iat) {
    const ageSec = Math.floor(Date.now() / 1000) - iat;
    checks.push({
      id: "freshness", label: "Token freshly issued",
      outcome: ageSec > 600 ? "warn" : "pass",
      detail: `Issued ${ageSec}s ago`,
    });
  }

  return { ok: checks.every((c) => c.outcome !== "fail"), claims, checks };
}

// ─── Userinfo ─────────────────────────────────────────────────────────────────

/**
 * Best-effort. Okta's ID token often omits claims that /userinfo returns — the
 * difference is exactly what an operator wants to see — but a failure here must
 * not fail the login test.
 */
export async function fetchUserinfo(
  meta: IssuerMetadata,
  accessToken: string,
): Promise<Record<string, unknown> | null> {
  if (!meta.userinfo_endpoint) return null;
  try {
    const res = await fetch(meta.userinfo_endpoint, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    if (!res.ok) return null;
    return (await res.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}
