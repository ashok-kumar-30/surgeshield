'use client';
// src/app/organizer/events/new/page.tsx
// Create-event form — accessible only to ORGANIZER / ADMIN (enforced by middleware).

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface FormState {
  title:       string;
  description: string;
  isVirtual:   boolean;
  location:    string;
  meetingUrl:  string;
  startsAt:    string;
  endsAt:      string;
  totalSeats:  string;
  isPublished: boolean;
}

const INIT: FormState = {
  title: "", description: "", isVirtual: false,
  location: "", meetingUrl: "", startsAt: "", endsAt: "",
  totalSeats: "100", isPublished: false,
};

export default function NewEventPage() {
  const router = useRouter();
  const [form,    setForm]    = useState<FormState>(INIT);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [errors,  setErrors]  = useState<Record<string, string>>({});

  function set(key: keyof FormState, value: string | boolean) {
    setForm(f => ({ ...f, [key]: value }));
    setErrors(e => { const n = { ...e }; delete n[key]; return n; });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!form.title.trim())               e.title       = "Event title is required.";
    if (!form.startsAt)                   e.startsAt    = "Start date & time is required.";
    if (!form.totalSeats || +form.totalSeats < 1)
                                          e.totalSeats  = "Must have at least 1 seat.";
    if (form.isVirtual && !form.meetingUrl.trim())
                                          e.meetingUrl  = "Meeting URL is required for virtual events.";
    if (!form.isVirtual && !form.location.trim())
                                          e.location    = "Location is required for in-person events.";
    if (form.endsAt && form.startsAt && form.endsAt <= form.startsAt)
                                          e.endsAt      = "End time must be after start time.";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true); setError("");

    const res = await fetch("/api/organizer/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title:       form.title.trim(),
        description: form.description.trim() || undefined,
        isVirtual:   form.isVirtual,
        location:    form.isVirtual ? undefined : (form.location.trim() || undefined),
        meetingUrl:  form.isVirtual ? (form.meetingUrl.trim() || undefined) : undefined,
        startsAt:    new Date(form.startsAt).toISOString(),
        endsAt:      form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        totalSeats:  parseInt(form.totalSeats, 10),
        isPublished: form.isPublished,
      }),
    });

    setLoading(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setError(d.error ?? "Failed to create event. Please try again.");
      return;
    }

    const { event } = await res.json() as { event: { id: string } };
    router.push(form.isPublished ? `/events/${event.id}` : "/organizer/events/new?created=1");
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: "radial-gradient(ellipse 70% 40% at 50% 0%, rgba(99,102,241,0.10) 0%, transparent 60%), #020207",
      }}
    >
      <div className="max-w-2xl mx-auto px-6 py-16">

        {/* Header */}
        <div className="mb-10">
          <Link href="/events" className="text-xs text-slate-500 hover:text-slate-300 transition-colors mb-4 inline-flex items-center gap-1">
            ← Back to Events
          </Link>
          <h1 className="text-3xl font-extrabold text-white mt-3">Create New Event</h1>
          <p className="text-slate-400 text-sm mt-1">
            Fill in the details below. You can save as draft and publish later.
          </p>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-7">

          {/* Global error */}
          {error && (
            <div className="px-4 py-3 rounded-xl text-sm flex gap-2 items-start"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              ⚠️ {error}
            </div>
          )}

          {/* ── Basic info ─────────────────────────────────────────────────── */}
          <Card title="Event Details">
            <Field label="Event Title *" error={errors.title}>
              <input
                type="text"
                value={form.title}
                onChange={e => set("title", e.target.value)}
                placeholder="e.g. React India Conference 2026"
                className="input-dark"
                maxLength={160}
              />
            </Field>

            <Field label="Description" hint="Markdown supported">
              <textarea
                value={form.description}
                onChange={e => set("description", e.target.value)}
                placeholder="What is this event about? Who should attend?"
                rows={4}
                className="input-dark resize-none"
                maxLength={2000}
              />
            </Field>
          </Card>

          {/* ── Type ───────────────────────────────────────────────────────── */}
          <Card title="Event Type">
            <div className="grid grid-cols-2 gap-3">
              {[false, true].map(v => (
                <button
                  key={String(v)}
                  type="button"
                  onClick={() => set("isVirtual", v)}
                  className="py-4 rounded-2xl text-sm font-medium transition-all flex flex-col items-center gap-2"
                  style={{
                    background: form.isVirtual === v ? "rgba(99,102,241,0.15)" : "rgba(255,255,255,0.04)",
                    border: form.isVirtual === v ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    color: form.isVirtual === v ? "#a5b4fc" : "rgba(255,255,255,0.5)",
                  }}
                >
                  <span className="text-2xl">{v ? "🌐" : "📍"}</span>
                  {v ? "Virtual / Online" : "In-Person"}
                </button>
              ))}
            </div>

            {form.isVirtual ? (
              <Field label="Meeting URL *" error={errors.meetingUrl}>
                <input
                  type="url"
                  value={form.meetingUrl}
                  onChange={e => set("meetingUrl", e.target.value)}
                  placeholder="https://meet.google.com/abc-xyz"
                  className="input-dark"
                />
              </Field>
            ) : (
              <Field label="Venue / Location *" error={errors.location}>
                <input
                  type="text"
                  value={form.location}
                  onChange={e => set("location", e.target.value)}
                  placeholder="e.g. NSCI Dome, Mumbai"
                  className="input-dark"
                />
              </Field>
            )}
          </Card>

          {/* ── Date & time ────────────────────────────────────────────────── */}
          <Card title="Date & Time">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Starts At *" error={errors.startsAt}>
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={e => set("startsAt", e.target.value)}
                  className="input-dark"
                />
              </Field>
              <Field label="Ends At (optional)" error={errors.endsAt}>
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={e => set("endsAt", e.target.value)}
                  className="input-dark"
                />
              </Field>
            </div>
          </Card>

          {/* ── Capacity ───────────────────────────────────────────────────── */}
          <Card title="Capacity">
            <Field
              label="Total Seats *"
              hint="Set to a large number for free-flowing entry (e.g. 999999 for unlimited)."
              error={errors.totalSeats}
            >
              <input
                type="number"
                value={form.totalSeats}
                onChange={e => set("totalSeats", e.target.value)}
                min={1}
                max={1000000}
                className="input-dark"
              />
            </Field>
          </Card>

          {/* ── Publish ────────────────────────────────────────────────────── */}
          <Card title="Visibility">
            <button
              type="button"
              onClick={() => set("isPublished", !form.isPublished)}
              className="flex items-center gap-4 w-full text-left p-4 rounded-xl transition-all"
              style={{
                background: form.isPublished ? "rgba(16,185,129,0.08)" : "rgba(255,255,255,0.04)",
                border: form.isPublished ? "1px solid rgba(16,185,129,0.3)" : "1px solid rgba(255,255,255,0.08)",
              }}
            >
              {/* Toggle knob */}
              <div
                className="relative w-11 h-6 rounded-full flex-shrink-0 transition-colors duration-200"
                style={{ background: form.isPublished ? "#10b981" : "rgba(255,255,255,0.1)" }}
              >
                <div
                  className="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200"
                  style={{ left: form.isPublished ? "calc(100% - 20px)" : "4px" }}
                />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: form.isPublished ? "#34d399" : "rgba(255,255,255,0.6)" }}>
                  {form.isPublished ? "Publish Immediately" : "Save as Draft"}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {form.isPublished
                    ? "Event will be visible on the public events page."
                    : "Only you can see this event until you publish it."}
                </p>
              </div>
            </button>
          </Card>

          {/* ── Actions ────────────────────────────────────────────────────── */}
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={loading} className="btn-primary flex-1 py-3.5">
              {loading ? (
                <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Creating…</>
              ) : (
                form.isPublished ? "🚀 Create & Publish" : "💾 Save as Draft"
              )}
            </button>
            <Link href="/events" className="btn-ghost px-6 py-3.5">
              Cancel
            </Link>
          </div>

        </form>
      </div>
    </div>
  );
}

// ── Shared sub-components ──────────────────────────────────────────────────

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glass rounded-2xl p-6 space-y-5">
      <h2 className="text-xs font-bold uppercase tracking-widest text-slate-500">{title}</h2>
      {children}
    </div>
  );
}

function Field({
  label, hint, error, children,
}: {
  label: string; hint?: string; error?: string; children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-semibold uppercase tracking-widest text-slate-500">
          {label}
        </label>
        {hint && <span className="text-[10px] text-slate-600">{hint}</span>}
      </div>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
