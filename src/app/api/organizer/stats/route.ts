// src/app/api/organizer/stats/route.ts
// Returns organizer-scoped event stats. Accessible by ORGANIZER or ADMIN.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  const role = session?.user?.role;
  if (!session?.user || (role !== "ADMIN" && role !== "ORGANIZER")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Admins see all events; organizers see only their own
  const where = role === "ADMIN"
    ? { isPublished: true }
    : { organizerId: session.user.id!, isPublished: true };

  const events = await prisma.event.findMany({
    where,
    orderBy: { startsAt: "asc" },
    include: {
      organizer: { select: { name: true, email: true } },
      registrations: { select: { status: true } },
    },
  });

  const eventStats = events.map(ev => {
    const confirmed  = ev.registrations.filter(r => r.status === "CONFIRMED").length;
    const waitlisted = ev.registrations.filter(r => r.status === "WAITLISTED").length;
    const fillPct    = ev.totalSeats > 0
      ? Math.round(((ev.totalSeats - ev.availableSeats) / ev.totalSeats) * 100)
      : 0;
    return {
      id: ev.id, title: ev.title,
      organizer: ev.organizer.name ?? ev.organizer.email,
      totalSeats: ev.totalSeats, availableSeats: ev.availableSeats,
      confirmed, waitlisted, fillPct,
      startsAt: ev.startsAt, isVirtual: ev.isVirtual,
    };
  });

  const totalConfirmed  = eventStats.reduce((s, e) => s + e.confirmed, 0);
  const totalWaitlisted = eventStats.reduce((s, e) => s + e.waitlisted, 0);
  const totalSeats      = eventStats.reduce((s, e) => s + e.totalSeats, 0);

  return NextResponse.json({
    events: eventStats,
    summary: {
      totalEvents: events.length, totalConfirmed,
      totalWaitlisted, totalSeats,
    },
  });
}
