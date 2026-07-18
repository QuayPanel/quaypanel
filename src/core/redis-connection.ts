import type { RedisOptions } from "ioredis";
import { env } from "./env";

/**
 * Builds a Redis connection URL that includes password when REDIS_PASSWORD is set.
 * Prefers credentials already present in REDIS_URL.
 */
export function getRedisUrl(): string {
  const base = env.REDIS_URL;
  const password = env.REDIS_PASSWORD;

  if (!password) return base;

  try {
    const url = new URL(base);
    // Don't override password already embedded in REDIS_URL
    if (url.password) return base;
    url.password = password;
    return url.toString();
  } catch {
    return base;
  }
}

/** Shared options for ioredis + BullMQ (ioredis-compatible). */
export function getRedisConnectionOptions(): RedisOptions & { url: string } {
  const url = getRedisUrl();
  const password = env.REDIS_PASSWORD || undefined;

  return {
    url,
    password: password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  };
}
