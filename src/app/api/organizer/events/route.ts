// src/app/api/organizer/events/route.ts
// Create a new event — organizer/admin only.
// The auth() server-side check enforces the role independently of the
// middleware, so a direct API call cannot bypass the guard.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CreateEventSchema = z.object({
  title:       z.string().min(3, "Title must be at least 3 characters.").max(160),
  description: z.string().max(2000).optional(),
  location:    z.string().max(255).optional(),
  isVirtual:   z.boolean().default(false),
  meetingUrl:  z.string().url("Meeting URL must be a valid URL.").optional().or(z.literal("")),
  startsAt:    z.string().datetime({ message: "Invalid start date/time." }),
  endsAt:      z.string().datetime({ message: "Invalid end date/time." }).optional(),
  totalSeats:  z.number().int().min(1, "Must have at least 1 seat.").max(1_000_000),
  isPublished: z.boolean().default(false),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  // Server-side auth guard
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }
  if (session.user.role !== "ORGANIZER" && session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Organizer role required." }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "Invalid JSON." }, { status: 400 }); }

  const parsed = CreateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten().fieldErrors },
      { status: 422 }
    );
  }

  const {
    title, description, location, isVirtual, meetingUrl,
    startsAt, endsAt, totalSeats, isPublished,
  } = parsed.data;

  // Validate: virtual events need a meeting URL
  if (isVirtual && !meetingUrl) {
    return NextResponse.json(
      { error: "Virtual events require a meeting URL." },
      { status: 422 }
    );
  }

  const event = await prisma.event.create({
    data: {
      title,
      description:    description ?? null,
      location:       isVirtual ? null : (location ?? null),
      isVirtual,
      meetingUrl:     isVirtual ? (meetingUrl || null) : null,
      startsAt:       new Date(startsAt),
      endsAt:         endsAt ? new Date(endsAt) : null,
      totalSeats,
      availableSeats: totalSeats,   // availableSeats starts equal to totalSeats
      isPublished,
      organizerId:    session.user.id,
    },
    select: { id: true, title: true, isPublished: true },
  });

  return NextResponse.json({ event }, { status: 201 });
}

// GET — list events owned by the calling organizer
export async function GET(_req: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const events = await prisma.event.findMany({
    where: { organizerId: session.user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, startsAt: true, totalSeats: true,
      availableSeats: true, isPublished: true, isVirtual: true,
    },
  });

  return NextResponse.json({ events });
}
