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

// Auto-sanitize token to prevent bad copy-pastes (e.g. quotes, whitespace, or trailing "IN" artifact)
function getRedisToken(): string {
  const raw = process.env.UPSTASH_REDIS_REST_TOKEN || "";
  let token = raw.trim().replace(/^["']|["']$/g, "");
  if (token.endsWith("ZQIN")) {
    token = token.slice(0, -2);
  }
  return token;
}

export const redis =
  globalForRedis.redis ??
  new Redis({
    url: (process.env.UPSTASH_REDIS_REST_URL || "").trim().replace(/^["']|["']$/g, ""),
    token: getRedisToken(),
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redis = redis;
}
