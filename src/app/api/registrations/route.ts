// src/app/api/registrations/route.ts
//
// The "Shock Absorber" endpoint.
//
// Responsibilities:
//   1. Validate the incoming request body
//   2. Enforce per-user rate limiting via Upstash Redis
//   3. Emit an Inngest event and return 202 immediately
//
// This route deliberately avoids ANY database writes so that it can
// handle thousands of concurrent registration attempts and return a
// response in well under 50 ms.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { redis } from "@/lib/redis";
import { inngest } from "@/inngest/client";
import { prisma } from "@/lib/prisma";
import { trackRequestEvent } from "@/lib/metrics";

// ---------------------------------------------------------------------------
// Input schema
// ---------------------------------------------------------------------------

const RegistrationBodySchema = z.object({
  userId: z.string().cuid({ message: "userId must be a valid CUID." }),
  eventId: z.string().cuid({ message: "eventId must be a valid CUID." }),
});

// ---------------------------------------------------------------------------
// Rate-limit configuration
// ---------------------------------------------------------------------------

const RATE_LIMIT_REQUESTS = 3;   // max requests...
const RATE_LIMIT_WINDOW_SEC = 10; // ...per this many seconds

/**
 * Sliding-window rate limiter backed by a Redis sorted set.
 *
 * Algorithm:
 *   - Key  : `rl:reg:{userId}`
 *   - Store : sorted set where each member is a unique request ID and
 *             the score is the Unix timestamp in milliseconds.
 *   - On every request:
 *       1. Remove all members older than (now - window).
 *       2. Count remaining members.
 *       3. If count >= limit  -> reject.
 *       4. Otherwise          -> add current request and set TTL.
 *
 * Using a pipeline keeps this to a single round-trip.
 */
async function checkRateLimit(
  userId: string
): Promise<{ allowed: boolean; retryAfterSec: number }> {
  const key = `rl:reg:${userId}`;
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_SEC * 1_000;
  const requestId = `${now}-${Math.random()}`;

  // Upstash Redis pipeline -- executed atomically in one HTTP call.
  const results = await redis.pipeline()
    .zremrangebyscore(key, 0, windowStart)            // 1. evict stale entries
    .zcard(key)                                        // 2. count in-window reqs
    .zadd(key, { score: now, member: requestId })      // 3. record this request
    .expire(key, RATE_LIMIT_WINDOW_SEC)                // 4. auto-clean the key
    .exec();

  // results[1] is the ZCARD result (count BEFORE this request was added).
  const countBeforeThisRequest = (results[1] as number) ?? 0;

  if (countBeforeThisRequest >= RATE_LIMIT_REQUESTS) {
    // Remove the member we just added since we are rejecting this request.
    await redis.zrem(key, requestId).catch(() => {});
    return { allowed: false, retryAfterSec: RATE_LIMIT_WINDOW_SEC };
  }

  return { allowed: true, retryAfterSec: 0 };
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest): Promise<NextResponse> {
  // 1. Parse and validate the request body.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const parsed = RegistrationBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed.",
        details: parsed.error.flatten().fieldErrors,
      },
      { status: 422 }
    );
  }

  const { userId, eventId } = parsed.data;

  // 2. Check for an existing registration -- return a friendly 409 immediately
  //    instead of letting the user wait 15 s for a timeout.
  try {
    const existing = await prisma.registration.findUnique({
      where: { userId_eventId: { userId, eventId } },
      select: { status: true },
    });

    if (existing) {
      const msg =
        existing.status === "CONFIRMED"
          ? "You have already secured a spot for this event! Check your email for your confirmation."
          : existing.status === "WAITLISTED"
          ? "You are already on the waitlist for this event. We will notify you if a spot opens up."
          : "You have already submitted a registration for this event."

      return NextResponse.json(
        { error: msg, status: existing.status, alreadyRegistered: true },
        { status: 409 }
      );
    }
  } catch (dbErr) {
    // If the DB check fails, continue — the unique constraint will still
    // catch duplicates in the Inngest worker as a safety net.
    console.warn("[registrations] Duplicate check DB error, continuing:", dbErr);
  }

  // 3. Enforce per-user rate limiting.
  // Fails OPEN: if Redis is unavailable we log and allow the request through
  // rather than blocking all registrations. Inngest provides a second layer
  // of duplicate-detection via the DB unique constraint.
  try {
    const { allowed, retryAfterSec } = await checkRateLimit(userId);
    if (!allowed) {
      void trackRequestEvent("REJECTED");
      return NextResponse.json(
        {
          error: "Too many registration attempts. Please slow down.",
          retryAfterSec,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(retryAfterSec),
            "X-RateLimit-Limit": String(RATE_LIMIT_REQUESTS),
            "X-RateLimit-Window": `${RATE_LIMIT_WINDOW_SEC}s`,
          },
        }
      );
    }
  } catch (redisErr) {
    // Redis degraded — log and continue. The DB unique constraint prevents
    // duplicate registrations even without the rate limiter.
    console.warn("[registrations] Rate limiter unavailable, failing open:", redisErr);
  }

  // 3. Emit the Inngest event -- non-blocking, returns as soon as the
  //    event is accepted by the Inngest ingestion endpoint.
  try {
    await inngest.send({
      name: "event/registration.requested",
      data: {
        userId,
        eventId,
        requestedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("[registrations] Failed to enqueue Inngest event:", err);
    // Surface a 503 so the client can retry; the rate-limit entry will
    // expire naturally so the retry won't be penalised unfairly.
    return NextResponse.json(
      { error: "Registration service temporarily unavailable. Please retry." },
      { status: 503 }
    );
  }

  // 4. Return 202 immediately -- the worker will do the heavy lifting.
  void trackRequestEvent("ACCEPTED");
  return NextResponse.json(
    {
      message: "Registration queued.",
      status: "PENDING",
    },
    { status: 202 }
  );
}
