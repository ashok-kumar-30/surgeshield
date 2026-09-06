// src/lib/redis.ts
//
// Global Upstash Redis singleton.
//
// Upstash Redis uses HTTP under the hood, so there are no persistent
// TCP connections to pool — but we still avoid re-constructing the client
// on every hot-reload to preserve any in-memory caching the SDK does.

import { Redis } from "@upstash/redis";

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
