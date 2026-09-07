'use client';
// src/app/events/[eventId]/page.tsx
// User-facing event registration page with async queue-based flow.

import { useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase =
  | 'LOADING'
  | 'NOT_FOUND'
  | 'IDLE'
  | 'SUBMITTING'
  | 'WAITING'
  | 'CONFIRMED'
  | 'WAITLISTED'
  | 'ALREADY_REGISTERED'
  | 'TIMEOUT'
  | 'ERROR';

interface EventData {
  id: string;
  title: string;
  description?: string | null;
  location?: string | null;
  startsAt: string;
  endsAt?: string | null;
  totalSeats: number;
  availableSeats: number;
}

// ---------------------------------------------------------------------------
// Global CSS animations (injected once via <style>)
// ---------------------------------------------------------------------------

const ANIM_CSS = `
  @keyframes spin       { to { transform: rotate(360deg); } }
  @keyframes fadeinup   { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  @keyframes ring-pulse { 0%{transform:scale(1);opacity:.7} 100%{transform:scale(2.2);opacity:0} }
  @keyframes ring-pulse2{ 0%{transform:scale(1);opacity:.5} 100%{transform:scale(3);opacity:0} }
  @keyframes draw-check { to { stroke-dashoffset: 0; } }
  @keyframes burst      { 0%{transform:translate(0,0) rotate(0deg) scale(1);opacity:1} 100%{transform:translate(var(--bx),var(--by)) rotate(540deg) scale(.4);opacity:0} }
  @keyframes dot-bounce { 0%,80%,100%{transform:scale(.6);opacity:.3} 40%{transform:scale(1);opacity:1} }
  .anim-fadeinup { animation: fadeinup .5s ease both; }
  .spin-slow     { animation: spin 1.1s linear infinite; }
`;

// ---------------------------------------------------------------------------
// Confetti config
// ---------------------------------------------------------------------------

const CONFETTI = [
  { c:'#6366f1', bx:'-130px', by:'-150px', d:'.00s' },
  { c:'#ec4899', bx:'  -40px', by:'-170px', d:'.06s' },
  { c:'#10b981', bx:'   60px', by:'-160px', d:'.12s' },
  { c:'#f59e0b', bx:'  150px', by:'-100px', d:'.04s' },
  { c:'#06b6d4', bx:'  170px', by:'  10px', d:'.09s' },
  { c:'#8b5cf6', bx:'  140px', by:' 120px', d:'.15s' },
  { c:'#ef4444', bx:'   40px', by:' 170px', d:'.02s' },
  { c:'#f97316', bx:' -70px',  by:' 165px', d:'.11s' },
  { c:'#14b8a6', bx:'-155px',  by:'  90px', d:'.07s' },
  { c:'#a855f7', bx:'-170px',  by:' -20px', d:'.13s' },
  { c:'#22c55e', bx:' -90px',  by:'-130px', d:'.18s' },
  { c:'#f43f5e', bx:'  95px',  by:'-140px', d:'.08s' },
];

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday:'long', year:'numeric', month:'long', day:'numeric',
  });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
}

// ---------------------------------------------------------------------------
// Shared card wrapper
// ---------------------------------------------------------------------------

function Card({ children, accent = 'rgba(99,102,241,0.12)', border = 'rgba(99,102,241,0.25)' }: {
  children: React.ReactNode; accent?: string; border?: string;
}) {
  return (
    <div
      className='rounded-3xl p-8 w-full anim-fadeinup'
      style={{ background: accent, border: `1px solid ${border}`, backdropFilter: 'blur(20px)' }}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingScreen() {
  return (
    <div className='min-h-screen flex items-center justify-center' style={{ background:'linear-gradient(180deg,#020207 0%,#04040e 100%)' }}>
      <div className='flex flex-col items-center gap-4'>
        <div className='w-10 h-10 rounded-full border-2 border-indigo-500 border-t-transparent spin-slow' />
        <p className='text-slate-500 text-sm'>Loading event details…</p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Not found
// ---------------------------------------------------------------------------

function NotFoundScreen() {
  return (
    <div className='min-h-screen flex items-center justify-center p-4' style={{ background:'linear-gradient(180deg,#020207 0%,#04040e 100%)' }}>
      <Card accent='rgba(239,68,68,0.08)' border='rgba(239,68,68,0.25)'>
        <div className='text-center space-y-3'>
          <div className='text-5xl'>404</div>
          <h1 className='text-xl font-bold text-white'>Event Not Found</h1>
          <p className='text-slate-400 text-sm'>This event may have been removed or the link is incorrect.</p>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Waiting room
// ---------------------------------------------------------------------------

function WaitingCard({ dots }: { dots: number }) {
  return (
    <Card accent='rgba(99,102,241,0.09)' border='rgba(99,102,241,0.3)'>
      <div className='flex flex-col items-center gap-6 text-center'>
        {/* Concentric pulse rings */}
        <div className='relative flex items-center justify-center w-24 h-24'>
          <div className='absolute inset-0 rounded-full' style={{ background:'rgba(99,102,241,0.15)', animation:'ring-pulse 1.8s ease-out infinite' }} />
          <div className='absolute inset-0 rounded-full' style={{ background:'rgba(99,102,241,0.08)', animation:'ring-pulse2 1.8s ease-out infinite .5s' }} />
          <div className='relative z-10 w-16 h-16 rounded-full flex items-center justify-center' style={{ background:'rgba(99,102,241,0.25)', border:'1px solid rgba(99,102,241,0.5)' }}>
            <span className='text-3xl'>🎫</span>
          </div>
        </div>
        <div>
          <h2 className='text-2xl font-bold text-white mb-1'>You Are In Line</h2>
          <p className='text-indigo-300 text-sm'>Securing your ticket in real‑time…</p>
        </div>
        {/* Animated dots */}
        <div className='flex items-center gap-2'>
          {[0,1,2].map(i => (
            <span
              key={i}
              className='w-2 h-2 rounded-full inline-block'
              style={{ background:'#818cf8', animation:`dot-bounce 1.2s ease-in-out infinite`, animationDelay:`${i * 0.2}s` }}
            />))}
        </div>
        <p className='text-slate-400 text-xs leading-relaxed max-w-xs'>
          Our system is processing thousands of requests simultaneously.
          This usually resolves in a few seconds.
        </p>
        {/* Elapsed time bar */}
        <div className='w-full'>
          <div className='flex justify-between text-[10px] text-slate-600 mb-1'>
            <span>Processing</span>
            <span>{dots * 2}s elapsed</span>
          </div>
          <div className='w-full h-1 rounded-full' style={{ background:'rgba(255,255,255,0.06)' }}>
            <div
              className='h-1 rounded-full transition-all duration-[2000ms]'
              style={{ width:`${Math.min((dots/7)*100,95)}%`, background:'linear-gradient(90deg,#6366f1,#8b5cf6)' }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Confirmed
// ---------------------------------------------------------------------------

function ConfirmedCard({ event, email }: { event: EventData | null; email: string }) {
  return (
    <Card accent='rgba(16,185,129,0.09)' border='rgba(16,185,129,0.3)'>
      <div className='relative flex flex-col items-center gap-5 text-center overflow-hidden'>
        {/* Confetti burst */}
        <div className='absolute inset-0 pointer-events-none flex items-center justify-center'>
          {CONFETTI.map((p, i) => (
            <div
              key={i}
              className='absolute w-2.5 h-2.5 rounded-sm'
              style={{ background:p.c, ['--bx' as string]:p.bx, ['--by' as string]:p.by, animation:`burst 0.9s ease-out ${p.d} both` }}
            />))}
        </div>
        {/* Animated checkmark SVG */}
        <div className='relative z-10 w-20 h-20 rounded-full flex items-center justify-center' style={{ background:'rgba(16,185,129,0.15)', border:'2px solid rgba(16,185,129,0.4)' }}>
          <svg viewBox='0 0 48 48' fill='none' className='w-10 h-10'>
            <polyline
              points='10,26 20,36 38,14'
              stroke='#10b981'
              strokeWidth='4'
              strokeLinecap='round'
              strokeLinejoin='round'
              strokeDasharray='46'
              strokeDashoffset='46'
              style={{ animation:'draw-check 0.6s ease forwards 0.2s' }}
            />
          </svg>
        </div>
        <div>
          <p className='text-xs font-semibold tracking-widest uppercase mb-1' style={{ color:'#34d399' }}>Registration Confirmed</p>
          <h2 className='text-3xl font-extrabold text-white'>You&rsquo;re Going! 🎉</h2>
        </div>
        {event && (
          <div className='w-full rounded-2xl p-4 text-left space-y-1.5' style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)' }}>
            <p className='text-sm font-semibold text-white'>{event.title}</p>
            <p className='text-xs text-slate-400'>📅 {fmtDate(event.startsAt)} at {fmtTime(event.startsAt)}</p>
            {event.location && <p className='text-xs text-slate-400'>📍 {event.location}</p>}
          </div>
        )}
        {email && (
          <p className='text-xs text-slate-400'>
            Your ticket will be emailed to <span className='text-white font-medium'>{email}</span>
          </p>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Waitlisted
// ---------------------------------------------------------------------------

function WaitlistedCard({ onReset }: { onReset: () => void }) {
  return (
    <Card accent='rgba(245,158,11,0.08)' border='rgba(245,158,11,0.3)'>
      <div className='flex flex-col items-center gap-5 text-center'>
        <div className='w-20 h-20 rounded-full flex items-center justify-center text-4xl' style={{ background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.35)' }}>
          ⌛
        </div>
        <div>
          <p className='text-xs font-semibold tracking-widest uppercase mb-1' style={{ color:'#fbbf24' }}>Event Sold Out</p>
          <h2 className='text-2xl font-bold text-white'>You&rsquo;re on the Waitlist</h2>
        </div>
        <p className='text-slate-400 text-sm leading-relaxed max-w-xs'>
          No seats are available right now, but you&rsquo;ve secured a spot in the queue.
          We&rsquo;ll notify you <strong className='text-white'>instantly</strong> if one opens up.
        </p>
        <button
          onClick={onReset}
          className='w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-80 active:scale-95'
          style={{ background:'rgba(245,158,11,0.15)', border:'1px solid rgba(245,158,11,0.3)', color:'#fbbf24' }}
        >
          ← Try Another Email
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Already Registered
// ---------------------------------------------------------------------------

function AlreadyRegisteredCard({ registrationStatus, onReset }: { registrationStatus: string; onReset: () => void }) {
  const isConfirmed  = registrationStatus === 'CONFIRMED';
  const isWaitlisted = registrationStatus === 'WAITLISTED';
  return (
    <Card accent='rgba(99,102,241,0.08)' border='rgba(99,102,241,0.3)'>
      <div className='flex flex-col items-center gap-5 text-center'>
        <div className='w-20 h-20 rounded-full flex items-center justify-center text-4xl'
          style={{ background:'rgba(99,102,241,0.15)', border:'1px solid rgba(99,102,241,0.35)' }}>
          {isConfirmed ? '🎫' : isWaitlisted ? '⏳' : '✅'}
        </div>
        <div>
          <p className='text-xs font-semibold tracking-widest uppercase mb-1' style={{ color:'#a5b4fc' }}>
            Already Registered
          </p>
          <h2 className='text-2xl font-bold text-white'>
            {isConfirmed ? "You're Already In!" : isWaitlisted ? 'Already on Waitlist' : 'Already Registered'}
          </h2>
        </div>
        <div className='w-full rounded-2xl p-4' style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)' }}>
          <p className='text-sm text-slate-300 leading-relaxed'>
            {isConfirmed
              ? "🎉 Your spot is already confirmed! Check your email for the confirmation and calendar invite."
              : isWaitlisted
              ? "⏳ You are already on the waitlist. We will email you the moment a spot opens up."
              : 'You have already submitted a registration for this event.'}
          </p>
        </div>
        <button
          onClick={onReset}
          className='w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-80 active:scale-95'
          style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.3)', color:'#a5b4fc' }}
        >
          ← Back to Event
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Timeout
// ---------------------------------------------------------------------------

function TimeoutCard({ email }: { email: string }) {
  return (
    <Card accent='rgba(99,102,241,0.07)' border='rgba(99,102,241,0.2)'>
      <div className='flex flex-col items-center gap-5 text-center'>
        <div className='w-20 h-20 rounded-full flex items-center justify-center text-4xl' style={{ background:'rgba(99,102,241,0.12)', border:'1px solid rgba(99,102,241,0.3)' }}>
          ⌚
        </div>
        <div>
          <p className='text-xs font-semibold tracking-widest uppercase mb-1' style={{ color:'#a5b4fc' }}>Still Processing</p>
          <h2 className='text-2xl font-bold text-white'>Traffic is Exceptionally High</h2>
        </div>
        <p className='text-slate-400 text-sm leading-relaxed max-w-xs'>
          We are still processing your request in the background.
          Your position in the queue is <strong className='text-white'>saved</strong>.
        </p>
        <div className='w-full rounded-2xl p-4' style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)' }}>
          <p className='text-xs text-slate-300'>
            📧 We&rsquo;ll email your ticket confirmation to{' '}
            <span className='text-white font-semibold'>{email || 'the address you provided'}</span>{' '}
            as soon as it&rsquo;s ready.
          </p>
        </div>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Error
// ---------------------------------------------------------------------------

function ErrorCard({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <Card accent='rgba(239,68,68,0.08)' border='rgba(239,68,68,0.25)'>
      <div className='flex flex-col items-center gap-5 text-center'>
        <div className='w-20 h-20 rounded-full flex items-center justify-center text-4xl' style={{ background:'rgba(239,68,68,0.12)', border:'1px solid rgba(239,68,68,0.3)' }}>
          ⚠️
        </div>
        <div>
          <p className='text-xs font-semibold tracking-widest uppercase mb-1' style={{ color:'#f87171' }}>Something Went Wrong</p>
          <h2 className='text-2xl font-bold text-white'>Registration Failed</h2>
        </div>
        <p className='text-slate-400 text-sm leading-relaxed max-w-xs'>{message}</p>
        <button
          onClick={onReset}
          className='w-full py-3 rounded-xl text-sm font-semibold transition-all duration-200 hover:opacity-80 active:scale-95'
          style={{ background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171' }}
        >
          Try Again
        </button>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Input field
// ---------------------------------------------------------------------------

function Field({
  id, label, type = 'text', value, onChange, error, disabled, placeholder,
}: {
  id: string; label: string; type?: string; value: string;
  onChange: (v: string) => void; error?: string; disabled?: boolean; placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <div className='space-y-1.5'>
      <label htmlFor={id} className='block text-xs font-semibold uppercase tracking-widest' style={{ color:'rgba(255,255,255,0.45)' }}>
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete={type === 'email' ? 'email' : 'name'}
        className='w-full rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all duration-200 disabled:opacity-50'
        style={{
          background: 'rgba(255,255,255,0.06)',
          border: focused && !error ? '1px solid rgba(99,102,241,0.6)' : error ? '1px solid rgba(239,68,68,0.6)' : '1px solid rgba(255,255,255,0.1)',
          boxShadow: focused && !error ? '0 0 0 3px rgba(99,102,241,0.12)' : 'none',
        }}
      />
      {error && <p className='text-xs' style={{ color:'#f87171' }}>{error}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function EventPage() {
  const params   = useParams();
  const eventId  = typeof params.eventId === 'string' ? params.eventId : Array.isArray(params.eventId) ? params.eventId[0] : '';

  const { data: session } = useSession();
  const router = useRouter();

  const [phase,    setPhase]    = useState<Phase>('LOADING');
  const [event,    setEvent]    = useState<EventData | null>(null);
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [nameErr,  setNameErr]  = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [apiAlert, setApiAlert] = useState('');   // 429 inline alert
  const [errorMsg, setErrorMsg] = useState('');   // ERROR phase message
  const [existingStatus, setExistingStatus] = useState(''); // ALREADY_REGISTERED phase
  const [pollTick, setPollTick] = useState(0);   // drives progress bar
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const userIdRef  = useRef('');

  // Pre-fill form from session when available
  useEffect(() => {
    if (session?.user) {
      if (session.user.name)  setName(session.user.name);
      if (session.user.email) setEmail(session.user.email);
    }
  }, [session]);

  // Fetch event details on mount
  useEffect(() => {
    if (!eventId) { setPhase('NOT_FOUND'); return; }
    fetch(`/api/events/${eventId}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('not-found')))
      .then((data: EventData) => { setEvent(data); setPhase('IDLE'); })
      .catch(() => setPhase('NOT_FOUND'));
  }, [eventId]);

  // Cleanup polling on unmount
  useEffect(() => () => { if (pollingRef.current) clearInterval(pollingRef.current); }, []);

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): boolean {
    let ok = true;
    if (!name.trim()) { setNameErr('Full name is required.'); ok = false; } else setNameErr('');
    if (!email.trim()) { setEmailErr('Email address is required.'); ok = false; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setEmailErr('Please enter a valid email address.'); ok = false; }
    else setEmailErr('');
    return ok;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setApiAlert('');
    setPhase('SUBMITTING');
    try {
      // Step 1: Resolve userId — prefer the authenticated session, fall back to find-or-create
      let userId: string;
      if (session?.user?.id) {
        userId = session.user.id;
      } else {
        const uRes = await fetch('/api/users/find-or-create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), email: email.trim() }),
        });
        if (!uRes.ok) throw new Error('Unable to set up your account. Please try again.');
        const data = await uRes.json() as { userId: string };
        userId = data.userId;
      }
      userIdRef.current = userId;

      // Step 2: Enqueue the registration
      const rRes = await fetch('/api/registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, eventId }),
      });

      if (rRes.status === 429) {
        setPhase('IDLE');
        setApiAlert("You're clicking too fast! Please wait a moment and try again.");
        return;
      }
      if (rRes.status === 409) {
        const d = await rRes.json().catch(() => ({})) as { status?: string };
        setExistingStatus(d.status ?? 'CONFIRMED');
        setPhase('ALREADY_REGISTERED');
        return;
      }
      if (rRes.status === 202) {
        setPhase('WAITING');
        startPolling(userId);
        return;
      }
      if (!rRes.ok) {
        const d = await rRes.json().catch(() => ({})) as { error?: string };
        throw new Error(d.error ?? 'Registration failed. Please try again.');
      }
    } catch (err) {
      setPhase('ERROR');
      setErrorMsg(err instanceof Error ? err.message : 'An unexpected error occurred. Please try again.');
    }
  }

  // ── Polling ───────────────────────────────────────────────────────────────
  function startPolling(uid: string) {
    const t0 = Date.now();
    setPollTick(0);
    pollingRef.current = setInterval(async () => {
      const elapsed = Date.now() - t0;
      setPollTick(tick => tick + 1);
      if (elapsed > 15_000) {
        clearInterval(pollingRef.current!);
        pollingRef.current = null;
        setPhase('TIMEOUT');
        return;
      }
      try {
        const r = await fetch(`/api/registrations/status?userId=${uid}&eventId=${eventId}`);
        if (!r.ok) return;
        const { status } = await r.json() as { status: string };
        if (status === 'CONFIRMED')  { clearInterval(pollingRef.current!); pollingRef.current = null; setPhase('CONFIRMED'); }
        if (status === 'WAITLISTED') { clearInterval(pollingRef.current!); pollingRef.current = null; setPhase('WAITLISTED'); }
      } catch { /* network blip -- retry next tick */ }
    }, 2_000);
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  function reset() {
    if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    setPhase('IDLE'); setApiAlert(''); setErrorMsg(''); setExistingStatus(''); setPollTick(0);
  }

  const isFormLocked = phase === 'SUBMITTING' || phase === 'WAITING';

  // ── Early exits ───────────────────────────────────────────────────────────
  if (phase === 'LOADING')   return <LoadingScreen />;
  if (phase === 'NOT_FOUND') return <NotFoundScreen />;

  return (
    <div
      className='min-h-screen text-white'
      style={{
        background:
          'radial-gradient(ellipse 90% 60% at 50% -5%, rgba(99,102,241,0.18) 0%, transparent 65%), ' +
          'linear-gradient(180deg, #020207 0%, #04040e 100%)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{ANIM_CSS}</style>

      <div className='min-h-screen flex flex-col items-center justify-center p-4 gap-6'>

        {/* ── Event Header ──────────────────────────────────────────────────── */}
        {event && (phase === 'IDLE' || phase === 'SUBMITTING') && (
          <div className='text-center max-w-sm anim-fadeinup'>
            <p className='text-xs font-semibold uppercase tracking-widest mb-2' style={{ color:'rgba(99,102,241,0.8)' }}>
              🎟️ Event Registration
            </p>
            <h1 className='text-2xl font-extrabold text-white leading-tight mb-2'>{event.title}</h1>
            <div className='flex items-center justify-center gap-3 text-xs flex-wrap' style={{ color:'rgba(255,255,255,0.45)' }}>
              <span>📅 {fmtDate(event.startsAt)}</span>
              <span>🕒 {fmtTime(event.startsAt)}</span>
              {event.location && <span>📍 {event.location}</span>}
            </div>
            <div className='mt-3 inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full' style={{ background: event.availableSeats > 10 ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', border: event.availableSeats > 10 ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(239,68,68,0.3)', color: event.availableSeats > 10 ? '#34d399' : '#f87171' }}>
              <span className='w-1.5 h-1.5 rounded-full inline-block' style={{ background: event.availableSeats > 10 ? '#10b981' : '#ef4444' }} />
              {event.availableSeats > 0 ? `${event.availableSeats} seats remaining` : 'Sold out — join the waitlist'}
            </div>
          </div>
        )}

        {/* ── Main card ─────────────────────────────────────────────────────── */}
        <div className='w-full max-w-sm'>

          {/* FORM ─── IDLE / SUBMITTING */}
          {(phase === 'IDLE' || phase === 'SUBMITTING') && (
            <form
              onSubmit={handleSubmit}
              noValidate
              className='rounded-3xl p-7 space-y-5 anim-fadeinup'
              style={{ background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.09)', backdropFilter:'blur(20px)' }}
            >
              {/* 429 inline alert */}
              {apiAlert && (
                <div className='flex items-start gap-2.5 rounded-xl px-4 py-3 text-sm' style={{ background:'rgba(245,158,11,0.1)', border:'1px solid rgba(245,158,11,0.3)', color:'#fbbf24' }}>
                  <span className='mt-px flex-shrink-0'>⚠️</span>
                  <span>{apiAlert}</span>
                </div>
              )}

              <Field id='name'  label='Full Name'      value={name}  onChange={setName}  error={nameErr}  disabled={isFormLocked} placeholder='Jane Smith' />
              <Field id='email' label='Email Address'  type='email'  value={email} onChange={setEmail} error={emailErr} disabled={isFormLocked} placeholder='jane@example.com' />

              <button
                type='submit'
                disabled={isFormLocked}
                className='w-full py-3.5 rounded-xl text-sm font-bold tracking-wide transition-all duration-200 hover:opacity-90 active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2'
                style={{ background:'linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%)', color:'white' }}
              >
                {phase === 'SUBMITTING' ? (
                  <><div className='w-4 h-4 rounded-full border-2 border-white border-t-transparent spin-slow' />Processing…</>)
                : '🎫 Secure My Spot'}
              </button>

              <p className='text-center text-[10px]' style={{ color:'rgba(255,255,255,0.2)' }}>
                By registering you agree to our terms. No payment required.
              </p>
            </form>
          )}

          {/* WAITING ROOM */}
          {phase === 'WAITING'            && <WaitingCard   dots={pollTick} />}
          {phase === 'CONFIRMED'          && <ConfirmedCard event={event} email={email} />}
          {phase === 'WAITLISTED'         && <WaitlistedCard onReset={reset} />}
          {phase === 'ALREADY_REGISTERED' && <AlreadyRegisteredCard registrationStatus={existingStatus} onReset={reset} />}
          {phase === 'TIMEOUT'            && <TimeoutCard   email={email} />}
          {phase === 'ERROR'              && <ErrorCard     message={errorMsg} onReset={reset} />}

        </div>
      </div>
    </div>
  );
}