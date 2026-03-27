import { NextRequest, NextResponse } from "next/server";
import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from "jose";
import { ApiKeyService } from "./services/apiKeyService";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";

const apiKeyService = new ApiKeyService();

// ─── Okta JWT validation ───────────────────────────────────────────────────────
//
// Validates a Bearer token as an Okta-issued JWT by verifying its signature
// against Okta's JWKS endpoint.  The JWKS fetcher is created once at module
// level so jose can cache the key set across requests — no redundant network
// calls after the first fetch.

const BASE_URL        = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
const NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET      ?? "";
const OKTA_ISSUER     = process.env.OKTA_ISSUER          ?? "";

let jwksFetcher: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJwksFetcher(): ReturnType<typeof createRemoteJWKSet> | null {
  if (!OKTA_ISSUER) return null;
  if (!jwksFetcher) {
    jwksFetcher = createRemoteJWKSet(new URL(`${OKTA_ISSUER}/v1/keys`));
  }
  return jwksFetcher;
}

async function validateOktaJwt(token: string): Promise<boolean> {
  const fetcher = getJwksFetcher();
  if (!fetcher) return false;

  try {
    await jwtVerify(token, fetcher, { issuer: OKTA_ISSUER });
    return true;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      console.warn("[apiHelper] Okta JWT rejected: token expired.");
    } else if (err instanceof joseErrors.JWTClaimValidationFailed) {
      console.warn("[apiHelper] Okta JWT rejected: claim validation failed.", (err as Error).message);
    } else if (
      err instanceof joseErrors.JWSSignatureVerificationFailed ||
      err instanceof joseErrors.JWSInvalid
    ) {
      // Not an Okta token — expected when an API key is sent; stay silent.
    } else {
      console.warn("[apiHelper] Okta JWT validation error:", (err as Error).message);
    }
    return false;
  }
}

// ─── Local JWT validation ─────────────────────────────────────────────────────
//
// Validates a Bearer token issued by our own /api/oauth2/token endpoint via the
// client_credentials grant.  Uses the NEXTAUTH_SECRET as the HS256 signing key —
// no network calls required.

async function validateLocalJwt(token: string): Promise<boolean> {
  if (!NEXTAUTH_SECRET) return false;
  try {
    const key = new TextEncoder().encode(NEXTAUTH_SECRET);
    await jwtVerify(token, key, { issuer: BASE_URL });
    return true;
  } catch (err) {
    if (err instanceof joseErrors.JWTExpired) {
      console.warn("[apiHelper] Local JWT rejected: token expired.");
    }
    return false;
  }
}

// ─── Guard ────────────────────────────────────────────────────────────────────
//
// Returns null (allow) when ANY of these conditions is true:
//   1. A valid NextAuth session exists (admin UI login)
//   2. The Bearer token matches a stored API key
//   3. The Bearer token is a locally-issued client_credentials JWT
//   4. The Bearer token is a valid Okta JWT (OAuth flow via /oauth2/authorize)
//
// Returns a 401 response otherwise.

export async function protectWithApiKey(
  request: NextRequest
): Promise<NextResponse | null> {
  // 1. NextAuth session
  const session = await getServerSession(authOptions);
  if (session?.user) return null;

  const authHeader = request.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);

    // 2. Stored API key
    const isApiKey = await apiKeyService.validateKey(token);
    if (isApiKey) return null;

    // 3 & 4. JWT path — only attempt if the token looks like a JWT to avoid
    //        unnecessary crypto work for opaque API keys.
    if (token.startsWith("eyJ")) {
      // 3. Local client-credentials JWT (no network call)
      const isLocal = await validateLocalJwt(token);
      if (isLocal) return null;

      // 4. Okta JWT (fetches JWKS on first call, cached thereafter)
      const isOktaJwt = await validateOktaJwt(token);
      if (isOktaJwt) return null;
    }
  }

  return NextResponse.json(
    {
      schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
      detail:  "Unauthorized. Provide a valid session, API key, client_credentials JWT, or Okta OAuth token.",
      status:  "401",
    },
    { status: 401 }
  );
}
