// src/app/api/dashboard/route.ts
// Returns the current user's registrations + upcoming events.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [registrations, upcoming] = await Promise.all([
    prisma.registration.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        event: {
          select: {
            id: true, title: true, startsAt: true, endsAt: true,
            location: true, isVirtual: true, meetingUrl: true,
            availableSeats: true, totalSeats: true,
          },
        },
      },
    }),
    prisma.event.findMany({
      where: { isPublished: true, startsAt: { gte: new Date() } },
      orderBy: { startsAt: "asc" },
      take: 5,
      select: {
        id: true, title: true, startsAt: true, location: true,
        isVirtual: true, availableSeats: true, totalSeats: true,
      },
    }),
  ]);

  return NextResponse.json({ registrations, upcoming });
}
