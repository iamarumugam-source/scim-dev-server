import { SignJWT, jwtVerify } from "jose";
import type { NextResponse } from "next/server";

/**
 * Short-lived transaction state for the downstream OIDC login test.
 *
 * WHY A SIGNED COOKIE. `state`, `nonce` and the PKCE verifier have to survive a
 * round trip through Okta and come back to a different serverless invocation.
 * The app's existing caches (`lib/tenant-settings.ts`, `lib/rate-limit.ts`) are
 * per-instance in-memory Maps, so on Vercel the callback would frequently land on
 * an instance that has never seen the value. A cookie travels with the browser and
 * needs no shared store.
 *
 * It is signed rather than encrypted: none of the contents are secret, but they
 * must not be attacker-chosen — a forged `state`/`nonce` pair would defeat exactly
 * the CSRF and token-injection protections they exist to provide.
 */

const COOKIE  = "ds_oidc_tx";
const TTL_SEC = 600; // 10 minutes — an interactive login, not a background job

export interface TxState {
  tenantId:    string;
  state:       string;
  nonce:       string;
  verifier:    string;
  initiatedBy: "sp" | "idp";
}

function key(): Uint8Array {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("NEXTAUTH_SECRET is required to sign the OIDC transaction cookie.");
  return new TextEncoder().encode(secret);
}

export async function sealTx(tx: TxState): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ ...tx })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + TTL_SEC)
    .sign(key());
}

/** Returns null for anything unusable — missing, tampered with, or expired. */
export async function openTx(token: string | undefined): Promise<TxState | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key());
    const { tenantId, state, nonce, verifier, initiatedBy } = payload as unknown as TxState;
    if (!tenantId || !state || !nonce || !verifier) return null;
    return { tenantId, state, nonce, verifier, initiatedBy: initiatedBy === "idp" ? "idp" : "sp" };
  } catch {
    return null;
  }
}

export function attachTx(res: NextResponse, sealed: string): void {
  res.cookies.set(COOKIE, sealed, {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    // Lax, NOT Strict. The return leg from Okta is a cross-site top-level GET
    // navigation; Strict would withhold the cookie and every login would fail
    // with a state mismatch.
    sameSite: "lax",
    path:     "/api",
    maxAge:   TTL_SEC,
  });
}

/** Single-use: cleared on the callback whether it succeeded or failed. */
export function clearTx(res: NextResponse): void {
  res.cookies.set(COOKIE, "", {
    httpOnly: true,
    secure:   process.env.NODE_ENV === "production",
    sameSite: "lax",
    path:     "/api",
    maxAge:   0,
  });
}

export const TX_COOKIE_NAME = COOKIE;
