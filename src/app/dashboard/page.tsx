'use client';
// src/app/dashboard/page.tsx — Attendee "My Registrations" dashboard

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface EventInfo { id:string; title:string; startsAt:string; endsAt?:string|null; location?:string|null; isVirtual:boolean; meetingUrl?:string|null; availableSeats:number; totalSeats:number; }
interface Reg { id:string; status:string; createdAt:string; event:EventInfo; }
interface UpcomingEvent { id:string; title:string; startsAt:string; location?:string|null; isVirtual:boolean; availableSeats:number; totalSeats:number; }
interface Payload { registrations: Reg[]; upcoming: UpcomingEvent[]; }

const STATUS_CFG: Record<string,{label:string;color:string;bg:string;icon:string}> = {
  CONFIRMED:  { label:'Confirmed',  color:'#34d399', bg:'rgba(16,185,129,0.12)', icon:'🎫' },
  WAITLISTED: { label:'Waitlisted', color:'#fbbf24', bg:'rgba(245,158,11,0.12)',  icon:'⏳' },
  PENDING:    { label:'Pending',    color:'#818cf8', bg:'rgba(99,102,241,0.12)',  icon:'🔄' },
  CANCELLED:  { label:'Cancelled',  color:'#f87171', bg:'rgba(239,68,68,0.12)',   icon:'❌' },
};

function fmt(d:string) {
  return new Date(d).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric',year:'numeric'});
}
function fmtTime(d:string) {
  return new Date(d).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'});
}

export default function DashboardPage() {
  const [data,setData]   = useState<Payload|null>(null);
  const [error,setError] = useState('');

  useEffect(()=>{
    fetch('/api/dashboard')
      .then(r=>{ if(!r.ok) throw new Error(`${r.status}`); return r.json() as Promise<Payload>; })
      .then(setData)
      .catch(e=>setError(e.message));
  },[]);

  if (error === '401') return (
    <div className="min-h-screen flex items-center justify-center" style={{background:'#020207'}}>
      <div className="text-center space-y-4">
        <div className="text-5xl">🔒</div>
        <h1 className="text-xl font-bold text-white">Sign in to view your dashboard</h1>
        <Link href="/auth/signin" className="btn-primary px-6 py-3 inline-block">Sign In →</Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{background:'radial-gradient(ellipse 70% 40% at 50% 0%, rgba(99,102,241,0.10) 0%, transparent 60%), #020207'}}>
      <div className="max-w-6xl mx-auto px-6 py-12">

        {/* Header */}
        <div className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-widest text-indigo-400 mb-2">🎫 My Account</p>
          <h1 className="text-3xl font-extrabold text-white mb-1">My Registrations</h1>
          <p className="text-slate-500 text-sm">All your event registrations in one place.</p>
        </div>

        {/* Summary pills */}
        {data && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
            {[
              { label:'Total',      val: data.registrations.length,                                                color:'#818cf8', icon:'📋' },
              { label:'Confirmed',  val: data.registrations.filter(r=>r.status==='CONFIRMED').length,  color:'#34d399', icon:'🎫' },
              { label:'Waitlisted', val: data.registrations.filter(r=>r.status==='WAITLISTED').length, color:'#fbbf24', icon:'⏳' },
              { label:'Upcoming',   val: data.upcoming.length,                                         color:'#c084fc', icon:'📅' },
            ].map(s=>(
              <div key={s.label} className="rounded-2xl p-5 text-center" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <div className="text-2xl mb-1">{s.icon}</div>
                <p className="text-2xl font-extrabold" style={{color:s.color}}>{s.val}</p>
                <p className="text-[11px] uppercase tracking-widest mt-1" style={{color:'rgba(255,255,255,0.35)'}}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Registrations list */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{color:'rgba(255,255,255,0.4)'}}>Registration History</h2>
            {!data && !error && (
              <div className="space-y-3">
                {[1,2,3].map(i=><div key={i} className="h-24 rounded-2xl animate-pulse" style={{background:'rgba(255,255,255,0.04)'}} />)}
              </div>
            )}
            {error && error!=='401' && <p className="text-red-400 text-sm">Error loading data: {error}</p>}
            {data?.registrations.length===0 && (
              <div className="rounded-2xl p-10 text-center" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                <div className="text-4xl mb-3">🎪</div>
                <p className="text-white font-semibold mb-1">No registrations yet</p>
                <p className="text-slate-500 text-sm mb-4">Find an event and secure your spot!</p>
                <Link href="/events" className="btn-primary px-5 py-2 text-sm inline-block">Browse Events →</Link>
              </div>
            )}
            {data?.registrations.map(reg=>{
              const cfg = STATUS_CFG[reg.status] ?? STATUS_CFG.PENDING;
              return (
                <div key={reg.id} className="rounded-2xl p-5 transition-all duration-200 hover:-translate-y-0.5"
                  style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full"
                          style={{background:cfg.bg, color:cfg.color, border:`1px solid ${cfg.color}44`}}>
                          {cfg.icon} {cfg.label}
                        </span>
                        {reg.event.isVirtual && (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{background:'rgba(6,182,212,0.15)',color:'#67e8f9',border:'1px solid rgba(6,182,212,0.3)'}}>🌐 Virtual</span>
                        )}
                      </div>
                      <h3 className="font-bold text-white text-base leading-snug mb-1">{reg.event.title}</h3>
                      <p className="text-xs text-slate-500">
                        📅 {fmt(reg.event.startsAt)} at {fmtTime(reg.event.startsAt)}
                        {reg.event.location && ` · 📍 ${reg.event.location}`}
                      </p>
                      <p className="text-[11px] mt-1" style={{color:'rgba(255,255,255,0.2)'}}>Registered {fmt(reg.createdAt)}</p>
                    </div>
                    <Link href={`/events/${reg.event.id}`}
                      className="flex-shrink-0 text-xs px-3 py-2 rounded-xl transition-all hover:opacity-80"
                      style={{background:'rgba(99,102,241,0.12)',border:'1px solid rgba(99,102,241,0.3)',color:'#a5b4fc'}}>
                      View →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Upcoming events sidebar */}
          <div className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{color:'rgba(255,255,255,0.4)'}}>Discover Events</h2>
            {data?.upcoming.map(ev=>{
              const pct = ev.totalSeats>0?Math.round(((ev.totalSeats-ev.availableSeats)/ev.totalSeats)*100):0;
              const soldOut = ev.availableSeats===0;
              return (
                <div key={ev.id} className="rounded-2xl p-4" style={{background:'rgba(255,255,255,0.03)',border:'1px solid rgba(255,255,255,0.07)'}}>
                  <h3 className="font-semibold text-white text-sm mb-1 line-clamp-1">{ev.title}</h3>
                  <p className="text-xs text-slate-500 mb-2">📅 {fmt(ev.startsAt)}{ev.location && ` · 📍 ${ev.location}`}</p>
                  <div className="w-full h-1 rounded-full mb-2" style={{background:'rgba(255,255,255,0.06)'}}>
                    <div className="h-1 rounded-full" style={{width:`${pct}%`,background:pct>=90?'#ef4444':pct>=70?'#f59e0b':'linear-gradient(90deg,#6366f1,#8b5cf6)'}} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px]" style={{color:'rgba(255,255,255,0.3)'}}>{ev.availableSeats} seats left</span>
                    <Link href={`/events/${ev.id}`} className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300">
                      {soldOut ? 'Join Waitlist →' : 'Register →'}
                    </Link>
                  </div>
                </div>
              );
            })}
            <Link href="/events" className="block text-center text-xs text-indigo-400 hover:text-indigo-300 py-2">See all events →</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
