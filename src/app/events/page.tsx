// src/app/events/page.tsx
// Public events listing page — server component, fetches events directly from Prisma.

import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Upcoming Events",
  description: "Browse and register for upcoming events on SurgeShield.",
};

// Refresh this page every 30 seconds so new events appear without a full rebuild.
export const revalidate = 30;

const GRADIENTS = [
  "from-indigo-900/60 to-purple-900/60",
  "from-emerald-900/60 to-teal-900/60",
  "from-rose-900/60 to-pink-900/60",
  "from-amber-900/60 to-orange-900/60",
  "from-cyan-900/60 to-blue-900/60",
  "from-violet-900/60 to-fuchsia-900/60",
];

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default async function EventsPage() {
  const events = await prisma.event.findMany({
    where: { isPublished: true },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      isVirtual: true,
      startsAt: true,
      endsAt: true,
      totalSeats: true,
      availableSeats: true,
      organizer: { select: { name: true } },
    },
  });

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(99,102,241,0.10) 0%, transparent 60%), #020207",
      }}
    >
      <div className="max-w-7xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-12">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">
            🎫 All Events
          </p>
          <h1 className="text-4xl font-extrabold text-white mb-3">Upcoming Events</h1>
          <p className="text-slate-400">
            {events.length > 0
              ? `${events.length} event${events.length !== 1 ? "s" : ""} available for registration.`
              : "No events are published yet. Check back soon!"}
          </p>
        </div>

        {events.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, i) => {
              const pct =
                event.totalSeats > 0
                  ? Math.round(
                      ((event.totalSeats - event.availableSeats) / event.totalSeats) * 100
                    )
                  : 100;
              const soldOut = event.availableSeats === 0;
              const almost = !soldOut && event.availableSeats <= Math.ceil(event.totalSeats * 0.1);

              return (
                <div
                  key={event.id}
                  className="rounded-3xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-1"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.08)",
                  }}
                >
                  {/* Card banner */}
                  <div
                    className={`h-32 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} flex items-end p-4`}
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                        style={{
                          background: event.isVirtual
                            ? "rgba(6,182,212,0.2)"
                            : "rgba(99,102,241,0.2)",
                          color: event.isVirtual ? "#67e8f9" : "#a5b4fc",
                          border: event.isVirtual
                            ? "1px solid rgba(6,182,212,0.4)"
                            : "1px solid rgba(99,102,241,0.4)",
                        }}
                      >
                        {event.isVirtual ? "🌐 Virtual" : "📍 In-Person"}
                      </span>
                      {soldOut && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(239,68,68,0.2)",
                            color: "#f87171",
                            border: "1px solid rgba(239,68,68,0.4)",
                          }}
                        >
                          Sold Out
                        </span>
                      )}
                      {almost && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{
                            background: "rgba(245,158,11,0.2)",
                            color: "#fbbf24",
                            border: "1px solid rgba(245,158,11,0.4)",
                          }}
                        >
                          Almost Full
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Card body */}
                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <h2 className="text-base font-bold text-white leading-snug line-clamp-2">
                      {event.title}
                    </h2>

                    {event.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {event.description}
                      </p>
                    )}

                    <div className="space-y-1 text-xs text-slate-400">
                      <p>📅 {fmtDate(event.startsAt)} at {fmtTime(event.startsAt)}</p>
                      {event.location && <p>📍 {event.location}</p>}
                      {event.organizer.name && <p>👤 {event.organizer.name}</p>}
                    </div>

                    {/* Seat progress */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                        <span>{event.availableSeats} seats left</span>
                        <span>{pct}% full</span>
                      </div>
                      <div
                        className="w-full h-1.5 rounded-full"
                        style={{ background: "rgba(255,255,255,0.06)" }}
                      >
                        <div
                          className="h-1.5 rounded-full transition-all duration-700"
                          style={{
                            width: `${pct}%`,
                            background:
                              pct >= 100
                                ? "#ef4444"
                                : pct >= 90
                                ? "#f59e0b"
                                : "linear-gradient(90deg,#6366f1,#8b5cf6)",
                          }}
                        />
                      </div>
                    </div>

                    <div className="mt-auto pt-2">
                      <Link
                        href={`/events/${event.id}`}
                        className={soldOut ? "btn-ghost w-full" : "btn-primary w-full"}
                      >
                        {soldOut ? "Join Waitlist" : "Register Now →"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="text-center py-24">
      <div className="text-6xl mb-6">🎪</div>
      <h2 className="text-xl font-bold text-white mb-2">No events yet</h2>
      <p className="text-slate-500 mb-8 text-sm">
        Be the first to host an event on SurgeShield.
      </p>
      <Link href="/auth/signup?role=ORGANIZER" className="btn-primary">
        Become an Organizer
      </Link>
    </div>
  );
}
