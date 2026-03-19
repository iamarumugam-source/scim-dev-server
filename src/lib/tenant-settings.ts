/**
 * In-memory settings cache for per-tenant rate limit configuration.
 *
 * Works in both Edge (middleware) and Node.js (API routes) runtimes.
 * Each runtime maintains its own Map; the middleware refreshes its copy
 * by calling the settings API in the background when the cache is stale.
 *
 * Required Supabase table:
 *
 *   CREATE TABLE IF NOT EXISTS tenant_settings (
 *     "tenantId"           text        PRIMARY KEY,
 *     rate_limit_enabled   boolean     NOT NULL DEFAULT true,
 *     rate_limit_max       integer     NOT NULL DEFAULT 60,
 *     updated_at           timestamptz DEFAULT now()
 *   );
 */

export interface RateLimitConfig {
  enabled: boolean;
  maxPerMinute: number;
}

interface CacheEntry extends RateLimitConfig {
  fetchedAt: number;
}

const cache = new Map<string, CacheEntry>();
const TTL_MS = 30_000; // 30 seconds

/** Returns cached settings (or sensible defaults) and whether the entry is fresh. */
export function getCachedSettings(tenantId: string): { config: RateLimitConfig; fresh: boolean } {
  const entry = cache.get(tenantId);
  if (!entry) {
    return { config: { enabled: true, maxPerMinute: 60 }, fresh: false };
  }
  return {
    config:  { enabled: entry.enabled, maxPerMinute: entry.maxPerMinute },
    fresh:   Date.now() - entry.fetchedAt < TTL_MS,
  };
}

/** Stores settings in the cache. */
export function setCachedSettings(tenantId: string, config: RateLimitConfig): void {
  cache.set(tenantId, { ...config, fetchedAt: Date.now() });
}
