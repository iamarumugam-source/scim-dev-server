/** Simple in-memory sliding-window rate limiter (per Edge/Node worker instance). */

interface Entry {
  count:   number;
  resetAt: number;
}

const store = new Map<string, Entry>();

export interface RateLimitResult {
  allowed:   boolean;
  remaining: number;
  resetAt:   number;
}

/**
 * Check and increment the rate limit for `key`.
 * @param key      Unique bucket key, e.g. `"rate:{userId}"`.
 * @param limit    Max requests per window (default 60).
 * @param windowMs Window length in ms (default 60 000 = 1 min).
 */
export function checkRateLimit(
  key: string,
  limit   = 60,
  windowMs = 60_000,
): RateLimitResult {
  const now   = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count, resetAt: entry.resetAt };
}
