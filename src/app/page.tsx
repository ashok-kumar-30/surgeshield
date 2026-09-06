// src/app/page.tsx
// Landing page — server component, no auth required.

import Link from "next/link";

const STATS = [
  { value: "< 50ms", label: "P99 API response" },
  { value: "10,000+", label: "Concurrent registrations" },
  { value: "0", label: "Overbookings guaranteed" },
  { value: "99.9%", label: "Uptime SLA" },
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Shock Absorber API",
    desc: "The registration endpoint returns in < 50 ms under any load — no DB writes on the hot path. Requests are immediately enqueued to Inngest.",
    accent: "#6366f1",
  },
  {
    icon: "🔒",
    title: "Zero Overbooking",
    desc: "Atomic Prisma transactions with optimistic locking claim seats in a single SQL update. Concurrency is constrained at the worker level, not the DB level.",
    accent: "#10b981",
  },
  {
    icon: "♻️",
    title: "Durable Background Workers",
    desc: "Inngest step functions checkpoint every stage of the registration flow. A server restart mid-process never loses a registration or double-decrements a seat.",
    accent: "#8b5cf6",
  },
  {
    icon: "🛡️",
    title: "Per-User Rate Limiting",
    desc: "Sliding-window rate limiter backed by Upstash Redis rejects abusive clients before they reach any business logic, protecting downstream services during surges.",
    accent: "#f59e0b",
  },
  {
    icon: "📊",
    title: "Real-Time Ops Dashboard",
    desc: "Per-minute Redis counters track accepted, rejected, and failed requests. Health status auto-escalates from NOMINAL → DEGRADED → CRITICAL with webhook alerts.",
    accent: "#06b6d4",
  },
  {
    icon: "🎫",
    title: "Virtual Waiting Room",
    desc: "Users enter a branded waiting room that polls for their status every 2 seconds. A 15-second timeout gracefully degrades to an email-based fallback.",
    accent: "#ec4899",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Submit your registration",
    desc: "Your request hits the Shock Absorber API. Rate limiting runs. The event is emitted to Inngest in milliseconds.",
    color: "#6366f1",
  },
  {
    n: "02",
    title: "Enter the virtual queue",
    desc: "You're placed in a real-time waiting room. The Inngest worker atomically claims your seat — or places you on the waitlist.",
    color: "#8b5cf6",
  },
  {
    n: "03",
    title: "Get instantly confirmed",
    desc: "Your UI updates to CONFIRMED or WAITLISTED the moment the worker completes. A confirmation email is dispatched asynchronously.",
    color: "#c084fc",
  },
];

export default function HomePage() {
  return (
    <div className="relative overflow-hidden">
      {/* Background */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.18) 0%, transparent 60%), #020207",
        }}
      />
      <div className="fixed inset-0 pointer-events-none dot-grid opacity-50" />

      {/* ── Hero ─────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-20 text-center">
        <div
          className="inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-xs font-semibold tracking-widest uppercase"
          style={{
            background: "rgba(99,102,241,0.1)",
            border: "1px solid rgba(99,102,241,0.3)",
            color: "#a5b4fc",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
          Built for the SurgeShield Hackathon
        </div>

        <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-tight mb-6">
          Registration That{" "}
          <span className="text-gradient">Doesn&apos;t Break</span>
          <br />
          Under Pressure
        </h1>

        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          SurgeShield handles thousands of concurrent registrations without
          overbooking, without crashes, and without making you wait in a broken
          queue. Queue-based, resilient, observable.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/events" className="btn-primary px-8 py-4 text-base">
            🎫 Browse Events
          </Link>
          <Link href="/auth/signup?role=ORGANIZER" className="btn-ghost px-8 py-4 text-base">
            🏟️ Host an Event
          </Link>
        </div>
      </section>

      {/* ── Stats ────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="glass rounded-2xl p-6 text-center">
              <p className="text-3xl font-extrabold text-gradient mb-1">{s.value}</p>
              <p className="text-xs text-slate-500 uppercase tracking-widest">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ─────────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-6xl mx-auto px-6 pb-24">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">
            Engineered for the Surge
          </h2>
          <p className="text-slate-500 max-w-xl mx-auto">
            Every component is designed to absorb traffic spikes and fail
            gracefully — not silently.
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6 hover:-translate-y-1 transition-transform duration-200 relative overflow-hidden group">
              <div
                className="absolute -top-10 -left-10 w-40 h-40 rounded-full blur-3xl opacity-0 group-hover:opacity-20 transition-opacity duration-500 pointer-events-none"
                style={{ background: f.accent }}
              />
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center text-xl mb-4"
                style={{ background: `${f.accent}22`, border: `1px solid ${f.accent}44` }}
              >
                {f.icon}
              </div>
              <h3 className="font-semibold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ─────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-4xl mx-auto px-6 pb-28">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold text-white mb-3">How It Works</h2>
          <p className="text-slate-500">From click to confirmed in seconds — even at 10,000 RPS.</p>
        </div>

        <div className="relative">
          {/* Connecting line */}
          <div
            className="absolute left-7 top-8 bottom-8 w-px hidden md:block"
            style={{ background: "linear-gradient(180deg, #6366f1, #8b5cf6, #c084fc)" }}
          />

          <div className="space-y-8">
            {STEPS.map((s) => (
              <div key={s.n} className="flex gap-6 items-start">
                <div
                  className="relative z-10 w-14 h-14 rounded-2xl flex items-center justify-center font-mono font-bold text-sm flex-shrink-0"
                  style={{ background: `${s.color}22`, border: `1px solid ${s.color}55`, color: s.color }}
                >
                  {s.n}
                </div>
                <div className="glass rounded-2xl p-5 flex-1">
                  <h3 className="font-semibold text-white mb-1">{s.title}</h3>
                  <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────────────── */}
      <section className="relative z-10 max-w-2xl mx-auto px-6 pb-32 text-center">
        <div
          className="rounded-3xl p-10"
          style={{
            background: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)",
            border: "1px solid rgba(99,102,241,0.25)",
          }}
        >
          <h2 className="text-3xl font-bold text-white mb-3">Ready to Get Started?</h2>
          <p className="text-slate-400 mb-8">
            Create an account and register for an event — or host your own.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/auth/signup" className="btn-primary px-8 py-3">
              Create Free Account
            </Link>
            <Link href="/events" className="btn-ghost px-8 py-3">
              Browse Events
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────────── */}
      <footer
        className="relative z-10 border-t text-center py-8"
        style={{ borderColor: "rgba(255,255,255,0.06)" }}
      >
        <p className="text-xs text-slate-600">
          SurgeShield · Built with Next.js 15, Prisma, Inngest & Upstash Redis
        </p>
      </footer>
    </div>
  );
}
