// src/app/api/metrics/route.ts
//
// Dashboard data aggregator.
//
// Fans out to Redis (timeseries counters) and PostgreSQL (registration
// totals, seat availability) in parallel, then stitches everything into a
// single clean JSON payload the dashboard polls every 3 seconds.

import { NextResponse } from "next/server";
import { RegistrationStatus } from "@prisma/client";
import { redis } from "@/lib/redis";
import { prisma } from "@/lib/prisma";

// Number of historical minutes to include in the timeseries response.
const WINDOW_MINUTES = 15;

// This route is fully dynamic (live Redis + Prisma reads), so no caching.
export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    // -------------------------------------------------------------------------
    // 1. Build the ordered list of UTC minute strings for the rolling window.
    //    Index 0 = oldest, index N-1 = current minute.
    // -------------------------------------------------------------------------
    const now = Date.now();
    const minutes: string[] = Array.from(
      { length: WINDOW_MINUTES },
      (_, i) =>
        new Date(now - (WINDOW_MINUTES - 1 - i) * 60_000)
          .toISOString()
          .slice(0, 16)   // "YYYY-MM-DDTHH:MM"
    );

    // -------------------------------------------------------------------------
    // 2. Fan out to Redis + Postgres concurrently.
    //    All queries are read-only so we can safely parallelise.
    // -------------------------------------------------------------------------
    const redisPipeline = redis.pipeline();
    for (const minute of minutes) {
      redisPipeline.get(`metrics:surge:${minute}:ACCEPTED`);
      redisPipeline.get(`metrics:surge:${minute}:REJECTED`);
      redisPipeline.get(`metrics:surge:${minute}:FAILED`);
    }

    const [
      redisResults,
      confirmedCount,
      waitlistedCount,
      seatAggregates,
    ] = await Promise.all([
      redisPipeline.exec(),
      prisma.registration.count({ where: { status: RegistrationStatus.CONFIRMED } }),
      prisma.registration.count({ where: { status: RegistrationStatus.WAITLISTED } }),
      prisma.event.aggregate({
        where: { isPublished: true },
        _sum: { totalSeats: true, availableSeats: true },
      }),
    ]);

    // -------------------------------------------------------------------------
    // 3. Parse the flat Redis pipeline results into structured timeseries data.
    //    redisResults is a flat array: [acc0, rej0, fail0, acc1, rej1, fail1, ...]
    // -------------------------------------------------------------------------
    const traffic = minutes.map((minute, i) => {
      const base = i * 3;
      return {
        minute,
        accepted: Number(redisResults[base] ?? 0),
        rejected: Number(redisResults[base + 1] ?? 0),
        failed:   Number(redisResults[base + 2] ?? 0),
      };
    });

    // -------------------------------------------------------------------------
    // 4. Derive aggregate KPIs.
    // -------------------------------------------------------------------------
    const totals = traffic.reduce(
      (acc, m) => ({
        accepted: acc.accepted + m.accepted,
        rejected: acc.rejected + m.rejected,
        failed:   acc.failed   + m.failed,
      }),
      { accepted: 0, rejected: 0, failed: 0 }
    );

    // "Current minute" slice for the headline Requests/Min KPI.
    const cur = traffic[traffic.length - 1];
    const requestsPerMinute = cur.accepted + cur.rejected;

    const totalSeats     = seatAggregates._sum.totalSeats     ?? 0;
    const availableSeats = seatAggregates._sum.availableSeats ?? 0;
    const claimedSeats   = totalSeats - availableSeats;

    const totalRequests  = totals.accepted + totals.rejected;
    const rawFailureRate =
      totalRequests > 0 ? (totals.failed / totalRequests) * 100 : 0;
    const failureRate    = Math.round(rawFailureRate * 100) / 100;

    const healthStatus =
      failureRate === 0 ? "NOMINAL" :
      failureRate <  5  ? "DEGRADED" :
                          "CRITICAL";

    // -------------------------------------------------------------------------
    // 5. Return the structured payload.
    // -------------------------------------------------------------------------
    return NextResponse.json({
      traffic,
      currentMinute: {
        requestsPerMinute,
        accepted: cur.accepted,
        rejected: cur.rejected,
        failed:   cur.failed,
      },
      totals,
      registrations: {
        confirmed:  confirmedCount,
        waitlisted: waitlistedCount,
      },
      seats: {
        total:          totalSeats,
        available:      availableSeats,
        claimed:        claimedSeats,
        utilizationPct:
          totalSeats > 0
            ? Math.round((claimedSeats / totalSeats) * 100)
            : 0,
      },
      health: {
        failureRate,
        isHealthy: failureRate < 5,
        status: healthStatus,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error("[metrics] Aggregation error:", err);
    return NextResponse.json(
      { error: "Failed to fetch metrics. Please retry." },
      { status: 500 }
    );
  }
}
