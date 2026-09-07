'use client';
// src/app/organizer/dashboard/page.tsx — Organizer Event Management Dashboard

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EventStat {
  id: string; title: string; startsAt: string; isVirtual: boolean;
  totalSeats: number; availableSeats: number;
  confirmed: number; waitlisted: number; fillPct: number;
}
interface OrgStats {
  events: EventStat[];
  summary: { totalEvents: number; totalConfirmed: number; totalWaitlisted: number; totalSeats: number; };
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function FillBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? '#ef4444' : pct >= 80 ? '#f59e0b' : '#10b981';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-[10px]" style={{ color: 'rgba(255,255,255,0.35)' }}>
        <span>{pct}% filled</span>
      </div>
      <div className="w-full h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${Math.min(pct, 100)}%`, background: color }} />
      </div>
    </div>
  );
}

export default function OrganizerDashboard() {
  const [data, setData]   = useState<OrgStats | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then(r => {
        if (r.status === 403) throw new Error('403');
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json() as Promise<{ events: any[]; summary: any }>;
      })
      .then(d => { setData(d as OrgStats); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (error === '403') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#020207' }}>
      <div className="text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold text-white">Access Restricted</h1>
        <p className="text-slate-500 text-sm">Only Organizers and Admins can view this page.</p>
        <Link href="/auth/signin" className="btn-primary px-6 py-3 inline-block">Sign In →</Link>
      </div>
    </div>
  );

  const s = data?.summary;

  return (
    <div className="min-h-screen" style={{ background: 'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 60%), #020207' }}>
      <div className="max-w-7xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-10">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-amber-400 mb-2">🏟️ Organizer Portal</p>
            <h1 className="text-3xl font-extrabold text-white">Event Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1">Manage your events, monitor registrations in real-time.</p>
          </div>
          <Link href="/organizer/events/new" className="btn-primary px-6 py-3">+ Create New Event</Link>
        </div>

        {/* Summary KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { icon: '🎪', label: 'My Events',       val: s?.totalEvents ?? 0,    color: '#fbbf24' },
            { icon: '🎫', label: 'Confirmed',        val: s?.totalConfirmed ?? 0, color: '#34d399' },
            { icon: '⏳', label: 'Waitlisted',       val: s?.totalWaitlisted ?? 0,color: '#f59e0b' },
            { icon: '💺', label: 'Total Capacity',   val: s?.totalSeats ?? 0,     color: '#818cf8' },
          ].map(k => (
            <div key={k.label} className="rounded-2xl p-5 text-center" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
              <div className="text-2xl mb-1">{k.icon}</div>
              <p className="text-2xl font-extrabold" style={{ color: k.color }}>{k.val.toLocaleString()}</p>
              <p className="text-[11px] uppercase tracking-widest mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>{k.label}</p>
            </div>
          ))}
        </div>

        {/* Events Table */}
        <div className="rounded-2xl overflow-hidden mb-8" style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.07)' }}>
          <div className="px-6 py-4 border-b flex items-center justify-between" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <div>
              <h2 className="text-sm font-semibold text-white">Your Events</h2>
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.3)' }}>Click an event to view its registration page</p>
            </div>
            {loading && <span className="text-xs text-slate-500 animate-pulse">Loading…</span>}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                  {['Event', 'Type', 'Date', 'Fill Rate', 'Confirmed', 'Waitlisted', 'Seats Left', 'Actions'].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.events ?? []).map(ev => (
                  <tr key={ev.id} className="transition-colors hover:bg-white/5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="px-5 py-4">
                      <p className="font-medium text-white max-w-[180px] truncate">{ev.title}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: ev.isVirtual ? 'rgba(6,182,212,0.15)' : 'rgba(99,102,241,0.15)', color: ev.isVirtual ? '#67e8f9' : '#a5b4fc' }}>
                        {ev.isVirtual ? '🌐 Virtual' : '📍 In-Person'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>{fmtDate(ev.startsAt)}</td>
                    <td className="px-5 py-4 min-w-[140px]"><FillBar pct={ev.fillPct} /></td>
                    <td className="px-5 py-4 font-mono text-emerald-400">{ev.confirmed}</td>
                    <td className="px-5 py-4 font-mono text-amber-400">{ev.waitlisted}</td>
                    <td className="px-5 py-4 font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{ev.availableSeats}</td>
                    <td className="px-5 py-4">
                      <Link href={`/events/${ev.id}`} className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:bg-white/10"
                        style={{ color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.3)' }}>View →</Link>
                    </td>
                  </tr>
                ))}
                {!loading && (data?.events ?? []).length === 0 && (
                  <tr><td colSpan={8} className="px-5 py-16 text-center">
                    <div className="text-4xl mb-3">🎪</div>
                    <p className="text-white font-semibold mb-1">No events yet</p>
                    <p className="text-slate-500 text-sm mb-4">Create your first event to start accepting registrations.</p>
                    <Link href="/organizer/events/new" className="btn-primary px-5 py-2 text-sm inline-block">+ Create Event</Link>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tips */}
        <div className="grid sm:grid-cols-3 gap-4">
          {[
            { icon: '⚡', title: 'Surge-Proof Registration', desc: 'Your event\'s registration endpoint handles thousands of concurrent users via Inngest queue. Zero setup needed.', color: '#818cf8' },
            { icon: '🔒', title: 'Zero Overbooking', desc: 'Seats are claimed atomically at the database level. It\'s impossible to oversell regardless of concurrent traffic.', color: '#10b981' },
            { icon: '📧', title: 'Auto Notifications', desc: 'Confirmation emails and calendar invites are sent automatically to attendees when they register.', color: '#f59e0b' },
          ].map(tip => (
            <div key={tip.title} className="rounded-2xl p-5" style={{ background: `${tip.color}08`, border: `1px solid ${tip.color}20` }}>
              <div className="text-2xl mb-2">{tip.icon}</div>
              <h3 className="font-semibold text-white text-sm mb-1">{tip.title}</h3>
              <p className="text-xs text-slate-400 leading-relaxed">{tip.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
