import { Redis } from "@upstash/redis";

/**
 * The Option-A-progressing-to-C data store for admin-editable figures
 * (diesel prices today; the natural place to extend to tax bands/tolls
 * later). Two implementations behind one interface:
 *
 * - MemoryStore: works everywhere, including this dev environment, with
 *   no setup — but is genuinely NOT persistent in a real Vercel
 *   deployment. Serverless functions don't share memory across
 *   invocations/regions and a cold start wipes it. This is an honest
 *   limitation, not a bug — the same class of caveat this project has
 *   carried since the AI rate limiter's in-memory Map (see README).
 * - RedisStore: a real persistent store via Upstash Redis, activated
 *   automatically the moment KV_REST_API_URL/KV_REST_API_TOKEN (Vercel's
 *   own env var names when a Redis/KV integration is attached from the
 *   Marketplace) or UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN are
 *   present — no code change needed to "upgrade" from A to C, only
 *   attaching a real store in the Vercel dashboard. This mirrors the
 *   exact pattern already established for the AI providers: build the
 *   full path now, degrade gracefully without credentials, unlock fully
 *   the moment real credentials exist.
 */
export interface KeyValueStore {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttlSeconds?: number): Promise<void>;
  delete(key: string): Promise<void>;
  readonly persistent: boolean;
}

class MemoryStore implements KeyValueStore {
  private map = new Map<string, unknown>();
  readonly persistent = false;

  async get<T>(key: string): Promise<T | null> {
    return (this.map.get(key) as T) ?? null;
  }

  async set<T>(key: string, value: T): Promise<void> {
    this.map.set(key, value);
  }

  async delete(key: string): Promise<void> {
    this.map.delete(key);
  }
}

class RedisStore implements KeyValueStore {
  readonly persistent = true;
  constructor(private redis: Redis) {}

  async get<T>(key: string): Promise<T | null> {
    const value = await this.redis.get<T>(key);
    return value ?? null;
  }

  async set<T>(key: string, value: T, ttlSeconds?: number): Promise<void> {
    if (ttlSeconds) await this.redis.set(key, value, { ex: ttlSeconds });
    else await this.redis.set(key, value);
  }

  async delete(key: string): Promise<void> {
    await this.redis.del(key);
  }
}

function buildStore(): KeyValueStore {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new RedisStore(new Redis({ url, token }));
  }
  return new MemoryStore();
}

// A module-level singleton so the in-memory fallback at least persists
// across requests within the same warm serverless instance / dev server
// process, not just within a single request.
let store: KeyValueStore | null = null;

export function getStore(): KeyValueStore {
  if (!store) store = buildStore();
  return store;
}
