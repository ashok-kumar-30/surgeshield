// src/app/events/page.tsx — Full-featured events listing with search, filter & sort
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Upcoming Events",
  description: "Browse, search, and register for upcoming events on SurgeShield.",
};

export const dynamic = "force-dynamic";

// Safe URL builder — strips undefined values so URLSearchParams never throws
function buildUrl(base: Record<string, string | undefined>, overrides: Record<string, string>): string {
  const merged = { ...base, ...overrides };
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== "") params.set(k, v);
  }
  return `/events?${params.toString()}`;
}

const GRADIENTS = [
  "linear-gradient(135deg,#312e81,#4c1d95)",
  "linear-gradient(135deg,#064e3b,#065f46)",
  "linear-gradient(135deg,#831843,#9d174d)",
  "linear-gradient(135deg,#78350f,#92400e)",
  "linear-gradient(135deg,#0c4a6e,#075985)",
  "linear-gradient(135deg,#4c1d95,#5b21b6)",
  "linear-gradient(135deg,#14532d,#166534)",
  "linear-gradient(135deg,#7f1d1d,#991b1b)",
];

const CATEGORY_LIST = [
  { label: "All", icon: "🌐" },
  { label: "Technology", icon: "💻" },
  { label: "Music", icon: "🎵" },
  { label: "Business", icon: "📈" },
  { label: "Creative", icon: "🎨" },
  { label: "Sports", icon: "🏃" },
  { label: "Education", icon: "🎓" },
  { label: "Community", icon: "🌍" },
  { label: "Food & Drink", icon: "🍕" },
];

type SearchParams = { q?: string; type?: string; sort?: string; };

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // Safely await Next.js 15+ async searchParams
  const sp = await searchParams;
  const q    = (sp.q    ?? "").trim().toLowerCase();
  const type = sp.type  ?? "all";
  const sort = sp.sort  ?? "date";

  let allEvents: any[] = [];
  try {
    allEvents = await prisma.event.findMany({
      where: { isPublished: true },
      orderBy: sort === "date"
        ? { startsAt: "asc" }
        : sort === "fill"
        ? { availableSeats: "asc" }
        : { availableSeats: "desc" },
      include: {
        organizer: { select: { name: true } },
        _count: { select: { registrations: true } },
      },
    });
  } catch (err) {
    console.error("Events fetch error:", err);
  }

  // Apply text + type filters
  const events = allEvents.filter(ev => {
    if (q) {
      const haystack = [ev.title, ev.description ?? "", ev.location ?? ""].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    if (type === "virtual"  && !ev.isVirtual) return false;
    if (type === "inperson" &&  ev.isVirtual) return false;
    return true;
  });

  const totalSeats     = events.reduce((s, e) => s + e.totalSeats, 0);
  const availableSeats = events.reduce((s, e) => s + e.availableSeats, 0);
  const soldOutCount   = events.filter(e => e.availableSeats === 0).length;

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(99,102,241,0.10) 0%, transparent 60%), #020207" }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12">

        {/* Page Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">🎫 Event Discovery</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3 tracking-tight">Upcoming Events</h1>
          <p className="text-slate-400">Find and register for events — real-time seat availability, zero overbooking.</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Events Found",     val: events.length,     color: "#818cf8" },
            { label: "Seats Available",  val: availableSeats,    color: "#34d399" },
            { label: "Total Capacity",   val: totalSeats,        color: "#a5b4fc" },
            { label: "Sold Out",         val: soldOutCount,      color: "#f87171" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 text-center"
              style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.val.toLocaleString()}</p>
              <p className="text-[11px] uppercase tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Category chips — use Link to preserve other params safely */}
        <div className="flex gap-2 flex-wrap mb-5">
          {CATEGORY_LIST.map(cat => {
            // Category is informational (not stored in DB), just a visual filter hint
            const active = !q && type === "all" && sort === "date" && cat.label === "All"
              || cat.label !== "All" && q === cat.label.toLowerCase();
            return (
              <Link key={cat.label}
                href={cat.label === "All" ? "/events" : buildUrl(sp, { q: cat.label.toLowerCase() })}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all duration-200"
                style={{
                  background: active ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
                  border: active ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                  color: active ? "#a5b4fc" : "rgba(255,255,255,0.5)",
                }}>
                <span>{cat.icon}</span>{cat.label}
              </Link>
            );
          })}
        </div>

        {/* Search + Filter form */}
        <form method="GET" action="/events" className="mb-8">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search box */}
            <div className="relative flex-1">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">🔍</span>
              <input
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Search by title, location, or description…"
                className="input-dark w-full pl-11 py-3"
              />
            </div>

            {/* Type */}
            <select name="type" defaultValue={type}
              className="input-dark py-3 px-4 text-sm cursor-pointer"
              style={{ width: "auto", minWidth: "140px" }}>
              <option value="all">🌍 All Types</option>
              <option value="virtual">🌐 Virtual</option>
              <option value="inperson">📍 In-Person</option>
            </select>

            {/* Sort */}
            <select name="sort" defaultValue={sort}
              className="input-dark py-3 px-4 text-sm cursor-pointer"
              style={{ width: "auto", minWidth: "160px" }}>
              <option value="date">📅 Date: Soonest</option>
              <option value="seats">💺 Most Seats</option>
              <option value="fill">🔥 Almost Full</option>
            </select>

            <button type="submit" className="btn-primary px-6 py-3 text-sm whitespace-nowrap">Search</button>
            {(q || type !== "all" || sort !== "date") && (
              <Link href="/events" className="btn-ghost px-4 py-3 text-sm whitespace-nowrap">✕ Reset</Link>
            )}
          </div>
        </form>

        {/* Active filter banner */}
        {q && (
          <div className="mb-6 flex items-center gap-2 text-sm px-4 py-2.5 rounded-xl w-fit"
            style={{ background: "rgba(99,102,241,0.1)", border: "1px solid rgba(99,102,241,0.2)", color: "#a5b4fc" }}>
            <span>🔍</span>
            <span>Showing results for <strong>&ldquo;{sp.q}&rdquo;</strong></span>
            <Link href="/events" className="ml-2 text-xs opacity-60 hover:opacity-100">✕ clear</Link>
          </div>
        )}

        {/* Grid */}
        {events.length === 0 ? (
          <EmptyState hasSearch={!!q} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {events.map((event, i) => {
              const pct     = event.totalSeats > 0 ? Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100) : 100;
              const soldOut = event.availableSeats === 0;
              const almost  = !soldOut && event.availableSeats <= Math.ceil(event.totalSeats * 0.15);
              const isPast  = new Date(event.startsAt) < new Date();
              const barColor = pct >= 100 ? "#ef4444" : pct >= 80 ? "#f59e0b" : "#10b981";

              return (
                <div key={event.id}
                  className="rounded-3xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 group"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>

                  {/* Banner gradient */}
                  <div className="h-32 flex items-end p-4 relative overflow-hidden"
                    style={{ background: GRADIENTS[i % GRADIENTS.length] }}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500"
                      style={{ background: "linear-gradient(135deg,rgba(255,255,255,0.1),transparent)" }} />
                    <div className="flex flex-wrap gap-1.5 relative z-10">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                        style={{
                          background: event.isVirtual ? "rgba(6,182,212,0.25)" : "rgba(99,102,241,0.25)",
                          color: event.isVirtual ? "#67e8f9" : "#a5b4fc",
                          border: event.isVirtual ? "1px solid rgba(6,182,212,0.4)" : "1px solid rgba(99,102,241,0.4)",
                        }}>
                        {event.isVirtual ? "🌐 Virtual" : "📍 In-Person"}
                      </span>
                      {soldOut && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(239,68,68,0.25)", color: "#fca5a5", border: "1px solid rgba(239,68,68,0.4)" }}>
                          Sold Out
                        </span>
                      )}
                      {almost && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(245,158,11,0.25)", color: "#fde68a", border: "1px solid rgba(245,158,11,0.4)" }}>
                          🔥 Almost Full
                        </span>
                      )}
                      {isPast && (
                        <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full"
                          style={{ background: "rgba(100,116,139,0.25)", color: "#94a3b8", border: "1px solid rgba(100,116,139,0.3)" }}>
                          Past
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <h2 className="text-base font-bold text-white leading-snug line-clamp-2">{event.title}</h2>
                    {event.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{event.description}</p>
                    )}

                    <div className="space-y-1.5 text-xs text-slate-400">
                      <div className="flex items-center gap-1.5">
                        <span>📅</span>
                        <span>{fmtDate(event.startsAt)} · {fmtTime(event.startsAt)}</span>
                      </div>
                      {event.location && (
                        <div className="flex items-center gap-1.5">
                          <span>📍</span><span className="truncate">{event.location}</span>
                        </div>
                      )}
                      {event.organizer?.name && (
                        <div className="flex items-center gap-1.5">
                          <span>👤</span><span>{event.organizer.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1.5">
                        <span>👥</span>
                        <span>{event._count.registrations} registered</span>
                      </div>
                    </div>

                    {/* Seat progress bar */}
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px]" style={{ color: "rgba(255,255,255,0.3)" }}>
                        <span>{event.availableSeats} / {event.totalSeats} seats left</span>
                        <span style={{ color: barColor }}>{pct}% full</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-1.5 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(pct, 100)}%`, background: barColor }} />
                      </div>
                    </div>

                    {/* CTA */}
                    <div className="mt-auto pt-2">
                      <Link href={`/events/${event.id}`}
                        className={soldOut ? "btn-ghost w-full" : "btn-primary w-full"}>
                        {isPast ? "📋 View Details" : soldOut ? "⏳ Join Waitlist" : "🎫 Register Now →"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {events.length > 0 && (
          <p className="text-center text-xs mt-10" style={{ color: "rgba(255,255,255,0.2)" }}>
            {events.length} event{events.length !== 1 ? "s" : ""} · Seats claimed atomically — zero overbooking guaranteed
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ hasSearch }: { hasSearch: boolean }) {
  return (
    <div className="text-center py-24">
      <div className="text-6xl mb-6">{hasSearch ? "🔍" : "🎪"}</div>
      <h2 className="text-xl font-bold text-white mb-2">
        {hasSearch ? "No events match your search" : "No events published yet"}
      </h2>
      <p className="text-slate-500 mb-8 text-sm max-w-xs mx-auto">
        {hasSearch
          ? "Try different keywords, or browse all events."
          : "Be the first to host an event on SurgeShield."}
      </p>
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {hasSearch && <Link href="/events" className="btn-ghost px-6 py-2.5">Browse All Events</Link>}
        <Link href="/auth/signup?role=ORGANIZER" className="btn-primary px-6 py-2.5">🏟️ Host an Event</Link>
      </div>
    </div>
  );
}
