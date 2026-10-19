import { signClientAssertion, tokenEndpoint } from "@/lib/network-zones";

export const ID_RE = /^[\w-]+$/;

/** Requests an org-authorization-server token for a private_key_jwt service app. */
export async function getClientToken(p: {
  orgUrl: string; clientId: string; kid: string; privateKeyPem: string; scopes: string[];
}) {
  const endpoint = tokenEndpoint(p.orgUrl, "org");
  const assertion = await signClientAssertion(p.clientId, endpoint, p.privateKeyPem, p.kid);
  const form = new URLSearchParams({
    grant_type: "client_credentials",
    client_assertion_type: "urn:ietf:params:oauth:client-assertion-type:jwt-bearer",
    client_assertion: assertion,
  });
  if (p.scopes.length) form.set("scope", p.scopes.join(" "));
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: form,
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body: body as Record<string, unknown> };
}

/** Only same-org Okta management API paths may be probed with the app's token. */
export function safeApiPath(path: unknown): string | null {
  if (typeof path !== "string" || !path.startsWith("/api/v1/")) return null;
  if (path.includes("..") || path.includes("//") || path.includes("@") || path.includes("\\")) return null;
  return path;
}

export function toStringList(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x.trim()).map((x) => x.trim()) : [];
}
