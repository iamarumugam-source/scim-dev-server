import { SignJWT, importPKCS8, generateKeyPair, exportJWK, exportPKCS8 } from "jose";
import { randomUUID } from "crypto";

export type AuthServerType = "org" | "custom";

/** Validates and normalises a user-supplied Okta org URL (https only, no IPs/localhost). */
export function normalizeOrgUrl(input: unknown): string | null {
  if (typeof input !== "string") return null;
  try {
    const u = new URL(input.trim());
    if (u.protocol !== "https:") return null;
    if (u.hostname === "localhost" || /^[\d.]+$/.test(u.hostname) || u.hostname.includes(":")) return null;
    return u.origin;
  } catch {
    return null;
  }
}

export function tokenEndpoint(orgUrl: string, type: AuthServerType, serverId?: string): string {
  return type === "custom"
    ? `${orgUrl}/oauth2/${encodeURIComponent(serverId || "default")}/v1/token`
    : `${orgUrl}/oauth2/v1/token`;
}

export async function createKeyPair() {
  const { publicKey, privateKey } = await generateKeyPair("RS256", { extractable: true });
  const kid = randomUUID();
  const jwk = { ...(await exportJWK(publicKey)), kid, use: "sig", alg: "RS256" };
  return { kid, publicJwk: jwk, privatePem: await exportPKCS8(privateKey) };
}

export async function signClientAssertion(clientId: string, aud: string, privatePem: string, kid: string) {
  const key = await importPKCS8(privatePem, "RS256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid })
    .setIssuer(clientId)
    .setSubject(clientId)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime("5m")
    .setJti(randomUUID())
    .sign(key);
}

export async function oktaAdmin(orgUrl: string, apiKey: string, path: string, init: RequestInit = {}) {
  const res = await fetch(`${orgUrl}${path}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `SSWS ${apiKey}`,
      ...(init.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: res.ok, status: res.status, body };
}
