import type { AiCompletionResult } from "./providers/types";

/**
 * Response cache — identical (feature, normalized inputs) pairs return a
 * cached answer instead of a fresh provider call. Same in-memory,
 * single-instance caveat as rateLimit.ts: a real win for reducing spend
 * within a warm instance, not a durable cross-instance cache.
 *
 * Only successful responses are cached — never a failure, so a transient
 * provider outage doesn't get "stuck" for other users during the TTL.
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

interface CacheEntry {
  result: AiCompletionResult;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export function getCached(key: string, now: number = Date.now()): AiCompletionResult | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (now > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.result;
}

export function setCached(key: string, result: AiCompletionResult, now: number = Date.now()): void {
  if (!result.ok) return;
  cache.set(key, { result, expiresAt: now + CACHE_TTL_MS });
}

/** Test-only: clears the cache so tests don't leak state into each other. */
export function _resetCacheState(): void {
  cache.clear();
}
