import Redis from "ioredis";
import { getRedisConnectionOptions } from "./redis-connection";
import { logger } from "./logger";

const globalForRedis = globalThis as unknown as {
  redis?: Redis;
};

function createRedis(): Redis {
  const options = getRedisConnectionOptions();
  const client = new Redis(options.url, {
    ...options,
    lazyConnect: true,
  });
  client.on("error", (error) => {
    logger.error({ err: error }, "Redis connection error");
  });
  return client;
}

export const redis = globalForRedis.redis ?? createRedis();

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}

async function ensureRedis() {
  if (redis.status === "wait") {
    await redis.connect();
  }
}

export const cacheKey = (...parts: string[]) => `cache:${parts.join(":")}`;
export const rateLimitKey = (...parts: string[]) => `rl:${parts.join(":")}`;
export const sessionKey = (...parts: string[]) => `sess:${parts.join(":")}`;

export async function cacheGet<T>(key: string): Promise<T | null> {
  try {
    await ensureRedis();
    const value = await redis.get(key);
    if (!value) return null;
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export async function cacheSet(
  key: string,
  value: unknown,
  ttlSeconds = 60,
): Promise<void> {
  try {
    await ensureRedis();
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (error) {
    logger.warn({ err: error }, "Cache set failed");
  }
}

export async function cacheDel(key: string): Promise<void> {
  try {
    await ensureRedis();
    await redis.del(key);
  } catch {
    // ignore
  }
}

/**
 * Sliding-window rate limit. Returns true if allowed.
 */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; remaining: number }> {
  try {
    await ensureRedis();
    const now = Date.now();
    const windowStart = now - windowSeconds * 1000;
    const multi = redis.multi();
    multi.zremrangebyscore(key, 0, windowStart);
    multi.zadd(key, now, `${now}-${Math.random()}`);
    multi.zcard(key);
    multi.expire(key, windowSeconds);
    const results = await multi.exec();
    const count = Number(results?.[2]?.[1] ?? 0);
    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
    };
  } catch (error) {
    logger.warn({ err: error }, "Rate limit check failed — allowing request");
    return { allowed: true, remaining: limit };
  }
}
