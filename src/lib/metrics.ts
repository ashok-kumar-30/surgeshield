// src/lib/metrics.ts
//
// Lightweight Redis-backed telemetry tracker.
//
// Increments per-minute counters keyed by UTC minute so the dashboard
// can render a real-time 15-minute traffic timeseries without touching
// PostgreSQL on the hot registration path.

import { redis } from "@/lib/redis";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MetricStatus = "ACCEPTED" | "REJECTED" | "FAILED";

// ---------------------------------------------------------------------------
// Internals
// ---------------------------------------------------------------------------

/**
 * Builds the Redis key for the given status scoped to the current UTC minute.
 * Format: metrics:surge:2026-09-06T12:58:ACCEPTED
 */
function buildKey(status: MetricStatus): string {
  // toISOString() returns "YYYY-MM-DDTHH:MM:SS.mmmZ"; slice to minute.
  const minute = new Date().toISOString().slice(0, 16);
  return `metrics:surge:${minute}:${status}`;
}

/**
 * TTL: 2 hours -- covers the 15-min dashboard window plus generous headroom
 * for delayed Inngest workers that report FAILED status after retries.
 */
const METRICS_TTL_SEC = 60 * 60 * 2;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Atomically increments the per-minute counter for `status`.
 *
 * Design decisions:
 *   - Uses a Redis pipeline so both INCR + EXPIRE land in one HTTP call to
 *     Upstash, keeping the overhead well under 5 ms on the hot path.
 *   - Errors are swallowed: a Redis blip must NEVER propagate to the
 *     user-facing registration endpoint or break an Inngest step.
 */
export async function trackRequestEvent(status: MetricStatus): Promise<void> {
  try {
    const key = buildKey(status);
    await redis
      .pipeline()
      .incr(key)
      .expire(key, METRICS_TTL_SEC)
      .exec();
  } catch (err) {
    // Metric loss is always preferable to cascading failures on the hot path.
    console.error("[metrics] Failed to track event:", status, err);
  }
}
