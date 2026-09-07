// src/app/api/admin/stats/route.ts
// Returns per-event breakdown for the admin dashboard.

import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [events, users, recentRegs] = await Promise.all([
    prisma.event.findMany({
      where: { isPublished: true },
      orderBy: { startsAt: "asc" },
      include: {
        _count: { select: { registrations: true } },
        organizer: { select: { name: true, email: true } },
        registrations: {
          select: { status: true, createdAt: true },
        },
      },
    }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    prisma.registration.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        status: true,
        createdAt: true,
        user:  { select: { name: true, email: true } },
        event: { select: { title: true } },
      },
    }),
  ]);

  const eventStats = events.map(ev => {
    const confirmed  = ev.registrations.filter(r => r.status === "CONFIRMED").length;
    const waitlisted = ev.registrations.filter(r => r.status === "WAITLISTED").length;
    const fillPct    = ev.totalSeats > 0 ? Math.round(((ev.totalSeats - ev.availableSeats) / ev.totalSeats) * 100) : 0;
    return {
      id:            ev.id,
      title:         ev.title,
      organizer:     ev.organizer.name ?? ev.organizer.email,
      totalSeats:    ev.totalSeats,
      availableSeats: ev.availableSeats,
      confirmed,
      waitlisted,
      fillPct,
      startsAt:      ev.startsAt,
      isVirtual:     ev.isVirtual,
    };
  });

  const totalUsers        = await prisma.user.count();
  const totalEvents       = await prisma.event.count();
  const totalConfirmed    = await prisma.registration.count({ where: { status: "CONFIRMED" } });
  const totalWaitlisted   = await prisma.registration.count({ where: { status: "WAITLISTED" } });

  return NextResponse.json({
    events:       eventStats,
    users,
    recentRegs,
    summary: { totalUsers, totalEvents, totalConfirmed, totalWaitlisted },
  });
}
