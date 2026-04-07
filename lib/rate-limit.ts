/**
 * Simple in-memory rate limiter for serverless environments.
 *
 * Uses a Map keyed by identifier (typically IP address) with timestamps.
 * Not perfect across cold starts / multiple instances, but zero-dependency
 * and catches the majority of abuse from a single origin.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Periodically clean expired entries to prevent memory leaks
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 60_000; // 1 minute

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [key, entry] of store) {
    if (now > entry.resetAt) {
      store.delete(key);
    }
  }
}

/**
 * Check and consume a rate limit token for the given identifier.
 *
 * @param identifier  Unique key (e.g. IP address or "ip:route")
 * @param limit       Max requests allowed in the window
 * @param windowMs    Time window in milliseconds
 * @returns           { success, remaining } — success=false means 429
 */
export function rateLimit(
  identifier: string,
  limit: number = 30,
  windowMs: number = 60_000,
): { success: boolean; remaining: number } {
  cleanup();

  const now = Date.now();
  const entry = store.get(identifier);

  if (!entry || now > entry.resetAt) {
    store.set(identifier, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }

  entry.count++;

  if (entry.count > limit) {
    return { success: false, remaining: 0 };
  }

  return { success: true, remaining: limit - entry.count };
}

/**
 * Extract client IP from request headers (works on Vercel / behind proxies).
 */
export function getClientIp(headers: Headers): string {
  return (
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headers.get("x-real-ip") ||
    "unknown"
  );
}
