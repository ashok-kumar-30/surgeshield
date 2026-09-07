// src/app/events/page.tsx — Full-featured events listing with search, filter & sort
import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = {
  title: "Upcoming Events",
  description: "Browse, search, and register for upcoming events on SurgeShield.",
};

export const dynamic = "force-dynamic";

const GRADIENTS = [
  "from-indigo-900/60 to-purple-900/60",
  "from-emerald-900/60 to-teal-900/60",
  "from-rose-900/60 to-pink-900/60",
  "from-amber-900/60 to-orange-900/60",
  "from-cyan-900/60 to-blue-900/60",
  "from-violet-900/60 to-fuchsia-900/60",
  "from-lime-900/60 to-green-900/60",
  "from-red-900/60 to-orange-900/60",
];

const CATEGORIES = ["All", "Technology", "Music", "Business", "Creative", "Sports", "Education", "Community", "Food & Drink"];

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

interface SearchParams { q?: string; category?: string; type?: string; sort?: string; }

export default async function EventsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const q        = sp.q?.toLowerCase() ?? "";
  const category = sp.category ?? "all";
  const type     = sp.type ?? "all";       // all | virtual | inperson
  const sort     = sp.sort ?? "date";      // date | seats | fill

  let events: any[] = [];
  try {
    events = await prisma.event.findMany({
      where: { isPublished: true },
      orderBy: sort === "date" ? { startsAt: "asc" } : { availableSeats: sort === "seats" ? "desc" : "asc" },
      select: {
        id: true, title: true, description: true, location: true,
        isVirtual: true, startsAt: true, endsAt: true,
        totalSeats: true, availableSeats: true,
        organizer: { select: { name: true } },
      },
    });
  } catch (err) {
    console.error("Failed to fetch events:", err);
  }

  // Client-side filters (no re-query for category since it's metadata not stored)
  const filtered = events.filter(ev => {
    if (q && !ev.title.toLowerCase().includes(q) && !(ev.description ?? "").toLowerCase().includes(q) && !(ev.location ?? "").toLowerCase().includes(q)) return false;
    if (type === "virtual" && !ev.isVirtual) return false;
    if (type === "inperson" && ev.isVirtual) return false;
    return true;
  });

  const totalSeats     = filtered.reduce((s, e) => s + e.totalSeats, 0);
  const availableSeats = filtered.reduce((s, e) => s + e.availableSeats, 0);
  const soldOutCount   = filtered.filter(e => e.availableSeats === 0).length;

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(99,102,241,0.10) 0%, transparent 60%), #020207" }}>
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">🎫 Event Discovery</p>
          <h1 className="text-4xl sm:text-5xl font-extrabold text-white mb-3">Upcoming Events</h1>
          <p className="text-slate-400">Find and register for events — real-time seat availability, zero overbooking.</p>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {[
            { label: "Total Events",      val: filtered.length,      color: "#818cf8" },
            { label: "Available Seats",   val: availableSeats,       color: "#34d399" },
            { label: "Total Capacity",    val: totalSeats,            color: "#a5b4fc" },
            { label: "Sold Out",          val: soldOutCount,          color: "#f87171" },
          ].map(s => (
            <div key={s.label} className="rounded-2xl p-4 text-center" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)" }}>
              <p className="text-2xl font-extrabold" style={{ color: s.color }}>{s.val.toLocaleString()}</p>
              <p className="text-[11px] uppercase tracking-widest mt-1" style={{ color: "rgba(255,255,255,0.35)" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Search + Filters */}
        <form method="GET" className="mb-8 space-y-4">
          {/* Search bar */}
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">🔍</span>
            <input
              name="q"
              defaultValue={sp.q}
              placeholder="Search events by title, description, or location…"
              className="input-dark w-full pl-12 py-4 text-base"
            />
          </div>

          {/* Filter row */}
          <div className="flex flex-wrap gap-3 items-center">
            {/* Category chips */}
            <div className="flex gap-2 flex-wrap">
              {CATEGORIES.map(cat => (
                <Link key={cat} href={`/events?${new URLSearchParams({ ...sp, category: cat.toLowerCase() }).toString()}`}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                  style={{
                    background: (category === cat.toLowerCase() || (cat === "All" && (!category || category === "all"))) ? "rgba(99,102,241,0.25)" : "rgba(255,255,255,0.05)",
                    border: (category === cat.toLowerCase() || (cat === "All" && (!category || category === "all"))) ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.1)",
                    color: (category === cat.toLowerCase() || (cat === "All" && (!category || category === "all"))) ? "#a5b4fc" : "rgba(255,255,255,0.5)",
                  }}>
                  {cat}
                </Link>
              ))}
            </div>

            <div className="flex gap-2 ml-auto">
              {/* Type filter */}
              <select name="type" defaultValue={type}
                className="input-dark py-2 px-3 text-xs cursor-pointer"
                style={{ width: "auto" }}
                onChange={(e) => { /* handled by form submit */ }}>
                <option value="all">🌍 All Types</option>
                <option value="virtual">🌐 Virtual</option>
                <option value="inperson">📍 In-Person</option>
              </select>

              {/* Sort */}
              <select name="sort" defaultValue={sort}
                className="input-dark py-2 px-3 text-xs cursor-pointer"
                style={{ width: "auto" }}>
                <option value="date">📅 Soonest First</option>
                <option value="seats">💺 Most Seats</option>
                <option value="fill">🔥 Almost Full</option>
              </select>

              <button type="submit" className="btn-primary py-2 px-4 text-xs">Apply</button>
              <Link href="/events" className="btn-ghost py-2 px-3 text-xs">Reset</Link>
            </div>
          </div>
        </form>

        {/* Results */}
        {filtered.length === 0 ? (
          <EmptyState hasSearch={!!q} />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((event, i) => {
              const pct = event.totalSeats > 0 ? Math.round(((event.totalSeats - event.availableSeats) / event.totalSeats) * 100) : 100;
              const soldOut = event.availableSeats === 0;
              const almost = !soldOut && event.availableSeats <= Math.ceil(event.totalSeats * 0.1);
              const isPast = new Date(event.startsAt) < new Date();
              return (
                <div key={event.id} className="rounded-3xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-1 hover:shadow-2xl group"
                  style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  {/* Banner */}
                  <div className={`h-32 bg-gradient-to-br ${GRADIENTS[i % GRADIENTS.length]} flex items-end p-4 relative overflow-hidden`}>
                    <div className="absolute inset-0 opacity-0 group-hover:opacity-20 transition-opacity duration-500" style={{ background: "linear-gradient(135deg,#6366f1,transparent)" }} />
                    <div className="flex items-center gap-2 flex-wrap relative z-10">
                      <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                        style={{ background: event.isVirtual ? "rgba(6,182,212,0.2)" : "rgba(99,102,241,0.2)", color: event.isVirtual ? "#67e8f9" : "#a5b4fc", border: event.isVirtual ? "1px solid rgba(6,182,212,0.4)" : "1px solid rgba(99,102,241,0.4)" }}>
                        {event.isVirtual ? "🌐 Virtual" : "📍 In-Person"}
                      </span>
                      {soldOut && <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: "rgba(239,68,68,0.2)", color: "#f87171", border: "1px solid rgba(239,68,68,0.4)" }}>Sold Out</span>}
                      {almost && <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: "rgba(245,158,11,0.2)", color: "#fbbf24", border: "1px solid rgba(245,158,11,0.4)" }}>🔥 Almost Full</span>}
                      {isPast && <span className="text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full" style={{ background: "rgba(100,100,100,0.2)", color: "#94a3b8", border: "1px solid rgba(100,100,100,0.3)" }}>Past Event</span>}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex flex-col flex-1 gap-3">
                    <h2 className="text-base font-bold text-white leading-snug line-clamp-2">{event.title}</h2>
                    {event.description && <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{event.description}</p>}

                    <div className="space-y-1 text-xs text-slate-400">
                      <p>📅 {fmtDate(event.startsAt)} at {fmtTime(event.startsAt)}</p>
                      {event.endsAt && <p>⏰ Ends {fmtTime(event.endsAt)}</p>}
                      {event.location && <p>📍 {event.location}</p>}
                      {event.organizer?.name && <p>👤 {event.organizer.name}</p>}
                    </div>

                    {/* Seat progress */}
                    <div>
                      <div className="flex justify-between text-[10px] text-slate-600 mb-1">
                        <span>{event.availableSeats} of {event.totalSeats} seats left</span>
                        <span>{pct}% full</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.06)" }}>
                        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: pct >= 100 ? "#ef4444" : pct >= 90 ? "#f59e0b" : "linear-gradient(90deg,#6366f1,#8b5cf6)" }} />
                      </div>
                    </div>

                    <div className="mt-auto pt-2">
                      <Link href={`/events/${event.id}`} className={soldOut ? "btn-ghost w-full" : "btn-primary w-full"}>
                        {isPast ? "View Details" : soldOut ? "⏳ Join Waitlist" : "🎫 Register Now →"}
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination hint */}
        {filtered.length > 0 && (
          <p className="text-center text-xs text-slate-700 mt-10">
            Showing {filtered.length} event{filtered.length !== 1 ? "s" : ""} · All seats claimed atomically — zero overbooking
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
        {hasSearch ? "No events match your search" : "No events yet"}
      </h2>
      <p className="text-slate-500 mb-8 text-sm">
        {hasSearch ? "Try different keywords or clear the filters." : "Be the first to host an event on SurgeShield."}
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link href="/events" className="btn-ghost px-6 py-2.5">Clear Filters</Link>
        <Link href="/auth/signup?role=ORGANIZER" className="btn-primary">🏟️ Host an Event</Link>
      </div>
    </div>
  );
}
