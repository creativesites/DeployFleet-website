/**
 * Rate limiting for the free, unauthenticated AI endpoint — the real risk
 * flagged in the Intelligence Hub plan §04: there's no account or payment
 * gate here to deter abuse, unlike every other AI feature in the
 * DeployFleet product.
 *
 * HONEST LIMITATION: this is an in-memory Map, scoped to a single warm
 * serverless instance. It resets on cold start and isn't shared across
 * concurrent instances — it is a first line of defense against a rapid
 * burst within one instance, NOT a reliable distributed rate limit or a
 * substitute for the real hard spend cap. That cap belongs on the
 * DeepSeek/Gemini provider's own billing dashboard (a hard budget limit
 * configured against the API key), which is the only mechanism that
 * actually enforces the $20/month ceiling regardless of how many
 * serverless instances are running. Upgrading this to a real distributed
 * limiter (Vercel KV or similar) is a legitimate follow-up once traffic
 * volume justifies the added infrastructure — not needed to ship safely
 * today alongside a provider-side spend cap.
 */

const WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
}

export function checkRateLimit(
  key: string,
  now: number = Date.now(),
  maxPerWindow: number = MAX_REQUESTS_PER_WINDOW
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true, remaining: maxPerWindow - 1 };
  }

  if (bucket.count >= maxPerWindow) {
    return { allowed: false, remaining: 0 };
  }

  bucket.count += 1;
  return { allowed: true, remaining: maxPerWindow - bucket.count };
}

/** Test-only: clears all buckets so tests don't leak state into each other. */
export function _resetRateLimitState(): void {
  buckets.clear();
}
