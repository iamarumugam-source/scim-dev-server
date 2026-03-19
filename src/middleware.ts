import { withAuth, NextRequestWithAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rate-limit";
import { getCachedSettings, setCachedSettings } from "@/lib/tenant-settings";

// Routes whose API calls are excluded from rate limiting
const RATE_LIMIT_EXCLUDED = ["/stats", "/analytics", "/logs"];

/** Fetch fresh settings from the API and populate the Edge-runtime cache. */
function refreshSettingsCache(userId: string, baseUrl: string): void {
  fetch(`${baseUrl}/api/${userId}/settings`)
    .then((r) => r.json())
    .then((data) => {
      setCachedSettings(userId, {
        enabled:      Boolean(data.rateLimitEnabled),
        maxPerMinute: Number(data.rateLimitMax) || 60,
      });
    })
    .catch(() => { /* silently ignore — stale/default values will be used */ });
}

export default withAuth(
  function middleware(req: NextRequestWithAuth) {
    const { pathname } = req.nextUrl;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "";

    // ── Rate limit SCIM API routes (except dashboard stats) ──────────────────
    const scimApiMatch = pathname.match(/^\/api\/([^/]+)\/scim\/v2\/(.+)$/);
    if (scimApiMatch) {
      const [, userId, subpath] = scimApiMatch;
      const isExcluded = RATE_LIMIT_EXCLUDED.some((ex) =>
        subpath.startsWith(ex.slice(1)),  // strip leading /
      );

      if (!isExcluded) {
        // Load cached rate-limit settings (stale-while-revalidate, 30 s TTL)
        const { config, fresh } = getCachedSettings(userId);
        if (!fresh) refreshSettingsCache(userId, baseUrl);

        // If rate limiting is disabled for this tenant, pass through immediately
        if (!config.enabled) {
          return NextResponse.next();
        }

        const limit  = config.maxPerMinute;
        const result = checkRateLimit(`rate:${userId}`, limit, 60_000);

        if (!result.allowed) {
          // Log the rate-limited request to scim_logs (fire-and-forget)
          fetch(`${baseUrl}/api/${userId}/scim/v2/logs`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              timestamp: new Date().toISOString(),
              path: pathname,
              request: {
                url: new URL(pathname, baseUrl).toString(),
                method: req.method,
                headers: {},
                ip: (req.headers.get("x-forwarded-for") ?? "127.0.0.1").split(",")[0].trim(),
                userAgent: req.headers.get("user-agent") ?? "unknown",
              },
              responseStatus: { status: 429, statusText: "Too Many Requests" },
              responseData: {
                schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
                detail:  `Too Many Requests — ${limit} requests/minute per tenant.`,
              },
            }),
          }).catch(() => {});

          return new NextResponse(
            JSON.stringify({
              schemas: ["urn:ietf:params:scim:api:messages:2.0:Error"],
              detail:  `Too Many Requests — ${limit} requests/minute per tenant.`,
              status:  "429",
            }),
            {
              status: 429,
              headers: {
                "Content-Type":          "application/scim+json",
                "X-RateLimit-Limit":     String(limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset":     String(Math.floor(result.resetAt / 1000)),
                "Retry-After":           String(Math.ceil((result.resetAt - Date.now()) / 1000)),
              },
            },
          );
        }

        // Attach rate-limit headers to allowed responses
        const response = NextResponse.next();
        response.headers.set("X-RateLimit-Limit",     String(limit));
        response.headers.set("X-RateLimit-Remaining", String(result.remaining));
        response.headers.set("X-RateLimit-Reset",     String(Math.floor(result.resetAt / 1000)));
        return response;
      }
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const { pathname } = req.nextUrl;
        // API routes handle their own auth — only check token for page routes
        if (pathname.startsWith("/api/")) return true;
        return !!token;
      },
    },
  },
);

export const config = {
  matcher: [
    // Protected pages (auth required)
    "/scim/:path*",
    "/meeting-planner/:path*",
    // SCIM API routes (for rate limiting only — no token check)
    "/api/:userId/scim/:path*",
  ],
};
