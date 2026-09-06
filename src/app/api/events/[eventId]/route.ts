// src/app/api/events/[eventId]/route.ts
// Public event-details endpoint consumed by the registration page client component.

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
): Promise<NextResponse> {
  const { eventId } = await params;

  if (!eventId) {
    return NextResponse.json({ error: "eventId is required." }, { status: 400 });
  }

  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId, isPublished: true },
      select: {
        id:             true,
        title:          true,
        description:    true,
        location:       true,
        startsAt:       true,
        endsAt:         true,
        totalSeats:     true,
        availableSeats: true,
      },
    });

    if (!event) {
      return NextResponse.json({ error: "Event not found." }, { status: 404 });
    }

    return NextResponse.json(event);
  } catch (err) {
    console.error("[events/:id] DB error:", err);
    return NextResponse.json({ error: "Failed to fetch event details." }, { status: 500 });
  }
}