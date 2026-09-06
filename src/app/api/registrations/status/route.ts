// src/app/api/registrations/status/route.ts
//
// Lightweight polling endpoint.
//
// The client UI hits this endpoint every 2 seconds after receiving a 202 from
// /api/registrations.  It returns the current DB status so the UI can decide
// when to stop polling and render the final outcome screen.
//
// PENDING   - The Inngest worker hasn't written the record yet.
// CONFIRMED - Seat was successfully claimed.
// WAITLISTED - No seats available; user placed on waitlist.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const QuerySchema = z.object({
  eventId: z.string().cuid({ message: "eventId must be a valid CUID." }),
  userId:  z.string().cuid({ message: "userId must be a valid CUID."  }),
});

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = req.nextUrl;

  const parsed = QuerySchema.safeParse({
    eventId: searchParams.get("eventId"),
    userId:  searchParams.get("userId"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query parameters.", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const { eventId, userId } = parsed.data;

  try {
    const registration = await prisma.registration.findUnique({
      where: { userId_eventId: { userId, eventId } },
      select: { status: true },
    });

    if (!registration) {
      // The Inngest worker hasn't persisted a record yet — still in flight.
      return NextResponse.json({ status: "PENDING" });
    }

    // Return the actual DB status so the UI can render the right outcome.
    return NextResponse.json({ status: registration.status });
  } catch (err) {
    console.error("[registrations/status] DB error:", err);
    return NextResponse.json(
      { error: "Failed to fetch registration status." },
      { status: 500 }
    );
  }
}
