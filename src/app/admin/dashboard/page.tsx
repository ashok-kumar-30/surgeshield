'use client';
import { useEffect, useState, useCallback } from 'react';

// --------------- Types ---------------
interface TrafficMinute { minute: string; accepted: number; rejected: number; failed: number; }
interface MetricsPayload {
  traffic: TrafficMinute[];
  currentMinute: { requestsPerMinute: number; accepted: number; rejected: number; failed: number; };
  totals:        { accepted: number; rejected: number; failed: number; };
  registrations: { confirmed: number; waitlisted: number; };
  seats:         { total: number; available: number; claimed: number; utilizationPct: number; };
  health:        { failureRate: number; isHealthy: boolean; status: 'NOMINAL' | 'DEGRADED' | 'CRITICAL'; };
  timestamp: string;
}

function fmt(n: number): string { return n.toLocaleString('en-US'); }

// --------------- SVG Sparkline ---------------
function AreaChart({ data, color, gradientId }: { data: number[]; color: string; gradientId: string }) {
  if (data.length < 2) return <div className='flex items-center justify-center h-20 text-xs' style={{ color: 'rgba(255,255,255,0.2)' }}>Waiting for data…</div>;
  const W=600, H=80, PAD=6, max=Math.max(...data, 1);
  const pts = data.map((v,i) => ({ x: PAD+(i/(data.length-1))*(W-PAD*2), y: PAD+(1-v/max)*(H-PAD*2) }));
  const seg = (a: {x:number;y:number}, b: {x:number;y:number}) => { const cx=(a.x+b.x)/2; return ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`; };
  const line = `M ${pts[0].x} ${pts[0].y}` + pts.slice(1).map((_,i)=>seg(pts[i],pts[i+1])).join('');
  const area = `${line} L ${pts[pts.length-1].x} ${H} L ${pts[0].x} ${H} Z`;
  const last = pts[pts.length-1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className='w-full h-20' preserveAspectRatio='none'>
      <defs><linearGradient id={gradientId} x1='0' y1='0' x2='0' y2='1'>
        <stop offset='0%' stopColor={color} stopOpacity='0.35' />
        <stop offset='100%' stopColor={color} stopOpacity='0' /></linearGradient></defs>
      <path d={area} fill={`url(#${gradientId})`} />
      <path d={line} fill='none' stroke={color} strokeWidth='2.5' strokeLinecap='round' />
      <circle cx={last.x} cy={last.y} r='4' fill={color} />
      <circle cx={last.x} cy={last.y} r='4' fill={color} opacity='0.4'>
        <animate attributeName='r' from='4' to='10' dur='1.5s' repeatCount='indefinite' />
        <animate attributeName='opacity' from='0.4' to='0' dur='1.5s' repeatCount='indefinite' />
      </circle>
    </svg>
  );
}

// --------------- Stat Card ---------------
function StatCard({ label, value, sub, accent, icon }: { label: string; value: number|string; sub?: string; accent: string; icon: string }) {
  return (
    <div className='relative overflow-hidden rounded-2xl p-5 transition-transform duration-200 hover:-translate-y-0.5'
         style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div className='absolute -top-8 -left-8 w-32 h-32 rounded-full blur-3xl opacity-15 pointer-events-none' style={{ background: accent }} />
      <div className='relative'>
        <div className='flex items-start justify-between mb-4'>
          <span className='text-xl'>{icon}</span>
          <span className='text-[10px] font-bold tracking-widest uppercase px-2 py-0.5 rounded-full' style={{ background: `${accent}22`, color: accent }}>LIVE</span>
        </div>
        <p className='text-[11px] font-semibold uppercase tracking-widest mb-1' style={{ color: 'rgba(255,255,255,0.35)' }}>{label}</p>
        <p className='text-3xl font-bold text-white tabular-nums leading-none'>{typeof value === 'number' ? fmt(value) : value}</p>
        {sub && <p className='text-[11px] mt-1.5' style={{ color: 'rgba(255,255,255,0.3)' }}>{sub}</p>}
      </div>
    </div>
  );
}

// --------------- Health Banner ---------------
const HEALTH_CFG = {
  NOMINAL:  { bg: 'rgba(16,185,129,0.08)',  border: 'rgba(16,185,129,0.25)', dot: '#10b981', text: '#34d399', label: 'System Nominal'  },
  DEGRADED: { bg: 'rgba(245,158,11,0.08)',  border: 'rgba(245,158,11,0.25)', dot: '#f59e0b', text: '#fbbf24', label: 'System Degraded' },
  CRITICAL: { bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.3)',   dot: '#ef4444', text: '#f87171', label: 'System Critical — Action Required' },
} as const;
function HealthBanner({ status, failureRate }: { status: keyof typeof HEALTH_CFG; failureRate: number }) {
  const c = HEALTH_CFG[status] ?? HEALTH_CFG.NOMINAL;
  return (
    <div className='flex items-center gap-3 px-5 py-3.5 rounded-2xl' style={{ background: c.bg, border: `1px solid ${c.border}` }}>
      <div className='relative flex items-center justify-center w-3 h-3 flex-shrink-0'>
        <span className='absolute inline-flex w-full h-full rounded-full animate-ping' style={{ background: c.dot, opacity: 0.6 }} />
        <span className='relative inline-flex w-3 h-3 rounded-full' style={{ background: c.dot }} />
      </div>
      <span className='text-sm font-semibold' style={{ color: c.text }}>{c.label}</span>
      <span className='ml-auto text-xs font-mono' style={{ color: c.text }}>{failureRate.toFixed(2)}% worker failure rate (threshold: 5%)</span>
    </div>
  );
}

// --------------- Seat Bar ---------------
function SeatBar({ claimed, available, total }: { claimed: number; available: number; total: number }) {
  const pct=total>0?(claimed/total)*100:0, color=pct>90?'#ef4444':pct>70?'#f59e0b':'#10b981';
  return (
    <div className='space-y-2'>
      <div className='flex justify-between text-xs' style={{ color: 'rgba(255,255,255,0.4)' }}>
        <span>{fmt(claimed)} claimed</span><span>{fmt(available)} remaining</span>
      </div>
      <div className='w-full h-2 rounded-full' style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div className='h-2 rounded-full transition-all duration-700' style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className='text-right text-[10px]' style={{ color: 'rgba(255,255,255,0.3)' }}>{Math.round(pct)}% utilisation</p>
    </div>
  );
}

// --------------- Mini Bar ---------------
function MiniBar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const pct=total>0?(value/total)*100:0;
  return (
    <div>
      <div className='flex justify-between text-xs mb-1.5' style={{ color: 'rgba(255,255,255,0.45)' }}>
        <span>{label}</span><span className='font-mono text-white'>{fmt(value)}</span>
      </div>
      <div className='w-full h-1.5 rounded-full' style={{ background: 'rgba(255,255,255,0.06)' }}>
        <div className='h-1.5 rounded-full transition-all duration-700' style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}

// --------------- Reg Pill ---------------
function RegPill({ icon, label, value, accent }: { icon: string; label: string; value: number; accent: string }) {
  return (
    <div className='flex items-center gap-3 p-4 rounded-xl' style={{ background: `${accent}0d`, border: `1px solid ${accent}33` }}>
      <div className='w-9 h-9 rounded-lg flex items-center justify-center text-lg' style={{ background: `${accent}22` }}>{icon}</div>
      <div>
        <p className='text-[11px] uppercase tracking-widest' style={{ color: 'rgba(255,255,255,0.4)' }}>{label}</p>
        <p className='text-2xl font-bold text-white tabular-nums leading-none mt-0.5'>{fmt(value)}</p>
      </div>
    </div>
  );
}

// --------------- Dashboard Page ---------------
export default function DashboardPage() {
  const [metrics,setMetrics]         = useState<MetricsPayload|null>(null);
  const [lastUpdated,setLastUpdated] = useState<string>('');
  const [fetchError,setFetchError]   = useState<string|null>(null);
  const fetchMetrics = useCallback(async () => {
    try {
      const res=await fetch('/api/metrics',{cache:'no-store'});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const data:MetricsPayload=await res.json();
      setMetrics(data); setLastUpdated(new Date().toLocaleTimeString()); setFetchError(null);
    } catch(err) { setFetchError(err instanceof Error?err.message:'Unknown error'); }
  },[]);
  useEffect(()=>{ void fetchMetrics(); const id=setInterval(fetchMetrics,3_000); return ()=>clearInterval(id); },[fetchMetrics]);

  const accepted15m=metrics?.traffic.map(t=>t.accepted)??[];
  const minuteLabels=metrics?.traffic.map(t=>t.minute.slice(11))??[];
  const queueTotal=(metrics?.totals.accepted??0)+(metrics?.totals.rejected??0);

  return (
    <main className='min-h-screen text-white'
          style={{ background:'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%), linear-gradient(180deg, #020207 0%, #04040e 100%)', fontFamily:"'Inter',system-ui,sans-serif" }}>
      <div className='fixed inset-0 pointer-events-none' style={{ backgroundImage:'radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px)', backgroundSize:'32px 32px' }} />
      <div className='relative z-10 max-w-7xl mx-auto px-6 py-8 space-y-6'>

        {/* Header */}
        <header className='flex items-start justify-between'>
          <div>
            <h1 className='text-2xl font-extrabold tracking-tight'>
              <span style={{ background:'linear-gradient(100deg,#818cf8 0%,#c084fc 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Registration Ops Dashboard</span>
            </h1>
            <p className='text-xs mt-1' style={{ color:'rgba(255,255,255,0.3)' }}>Event Platform · Real-Time Monitoring · Auto-refreshes every 3 s</p>
          </div>
          <div className='text-right space-y-1'>
            {fetchError
              ? <span className='inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full' style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.3)', color:'#f87171' }}>⚠ {fetchError}</span>
              : <span className='inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full' style={{ background:'rgba(16,185,129,0.08)', border:'1px solid rgba(16,185,129,0.2)', color:'#34d399' }}><span className='w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse' />LIVE</span>}
            <p className='text-[11px] font-mono' style={{ color:'rgba(255,255,255,0.25)' }}>{lastUpdated?`Updated ${lastUpdated}`:'Connecting…'}</p>
          </div>
        </header>

        {metrics && <HealthBanner status={metrics.health.status} failureRate={metrics.health.failureRate} />}

        {/* KPI Cards */}
        <div className='grid grid-cols-2 lg:grid-cols-4 gap-4'>
          <StatCard icon='⚡' label='Requests / Min'    value={metrics?.currentMinute.requestsPerMinute??0} sub='Current minute'                                         accent='#818cf8' />
          <StatCard icon='✅' label='Accepted'           value={metrics?.currentMinute.accepted??0}          sub={`${fmt(metrics?.totals.accepted??0)} total (15 min)`}  accent='#10b981' />
          <StatCard icon='🚫' label='Rate-Limited (429)' value={metrics?.currentMinute.rejected??0}   sub={`${fmt(metrics?.totals.rejected??0)} total (15 min)`}  accent='#f59e0b' />
          <StatCard icon='💥' label='Worker Failures'    value={metrics?.totals.failed??0}            sub={`${metrics?.health.failureRate??0}% failure rate`}     accent='#ef4444' />
        </div>

        {/* Sparkline */}
        <section className='rounded-2xl p-6' style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)' }}>
          <div className='flex items-center justify-between mb-1'>
            <div>
              <h2 className='text-sm font-semibold text-white'>Traffic Surge · Last 15 Minutes</h2>
              <p className='text-[11px] mt-0.5' style={{ color:'rgba(255,255,255,0.3)' }}>Accepted requests per minute window</p>
            </div>
            <div className='flex items-center gap-5 text-xs' style={{ color:'rgba(255,255,255,0.4)' }}>
              <span className='flex items-center gap-1.5'><span className='w-3 h-0.5 rounded-full inline-block' style={{ background:'#818cf8' }} />Accepted</span>
              <span className='flex items-center gap-1.5'><span className='w-3 h-0.5 rounded-full inline-block' style={{ background:'#f59e0b' }} />Rejected</span>
            </div>
          </div>
          <AreaChart data={accepted15m} color='#818cf8' gradientId='grad-accepted' />
          <div className='flex justify-between mt-1 px-1'>
            {minuteLabels.filter((_,i)=>i%3===0||i===minuteLabels.length-1).map(l=>(
              <span key={l} className='text-[10px] font-mono' style={{ color:'rgba(255,255,255,0.2)' }}>{l}</span>
            ))}
          </div>
        </section>

        {/* Bottom Row */}
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-4'>

          {/* Queue Health */}
          <div className='rounded-2xl p-6 space-y-5' style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <div><h2 className='text-sm font-semibold text-white'>Queue Processing Health</h2>
            <p className='text-[11px] mt-0.5' style={{ color:'rgba(255,255,255,0.3)' }}>Breakdown over last 15 minutes</p></div>
            <div className='space-y-4'>
              <MiniBar label='Accepted and Queued' value={metrics?.totals.accepted??0} total={queueTotal} color='#10b981' />
              <MiniBar label='Rate-Limited (429)'  value={metrics?.totals.rejected??0} total={queueTotal} color='#f59e0b' />
              <MiniBar label='Worker Failures'     value={metrics?.totals.failed??0}   total={queueTotal} color='#ef4444' />
            </div>
            <div className='flex items-center gap-2 text-xs px-3.5 py-2.5 rounded-xl' style={{ background:'rgba(99,102,241,0.08)', border:'1px solid rgba(99,102,241,0.2)' }}>
              <span className='w-1.5 h-1.5 rounded-full animate-pulse' style={{ background:'#818cf8' }} />
              <span style={{ color:'#a5b4fc' }}>Inngest concurrency limit: 10 / eventId</span>
            </div>
          </div>

          {/* Registrations */}
          <div className='rounded-2xl p-6 space-y-4' style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <div><h2 className='text-sm font-semibold text-white'>Registration Database</h2>
            <p className='text-[11px] mt-0.5' style={{ color:'rgba(255,255,255,0.3)' }}>Live counts from PostgreSQL</p></div>
            <div className='space-y-3'>
              <RegPill icon='🎫' label='Confirmed'  value={metrics?.registrations.confirmed??0}  accent='#10b981' />
              <RegPill icon='⏳'        label='Waitlisted' value={metrics?.registrations.waitlisted??0} accent='#f59e0b' />
            </div>
            <div className='text-center text-xs py-2 rounded-xl' style={{ background:'rgba(255,255,255,0.04)', color:'rgba(255,255,255,0.3)' }}>
              Total: <span className='text-white font-semibold'>{fmt((metrics?.registrations.confirmed??0)+(metrics?.registrations.waitlisted??0))}</span> registrations
            </div>
          </div>

          {/* Seats */}
          <div className='rounded-2xl p-6 space-y-5' style={{ background:'rgba(255,255,255,0.025)', border:'1px solid rgba(255,255,255,0.07)' }}>
            <div><h2 className='text-sm font-semibold text-white'>Seat Availability</h2>
            <p className='text-[11px] mt-0.5' style={{ color:'rgba(255,255,255,0.3)' }}>Across all published events</p></div>
            <div className='text-center py-2'>
              <p className='text-5xl font-extrabold tabular-nums tracking-tight' style={{ background:'linear-gradient(110deg,#818cf8 0%,#c084fc 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
                {fmt(metrics?.seats.claimed??0)}
              </p>
              <p className='text-xs mt-1' style={{ color:'rgba(255,255,255,0.3)' }}>seats claimed of {fmt(metrics?.seats.total??0)} total</p>
            </div>
            {metrics && <SeatBar claimed={metrics.seats.claimed} available={metrics.seats.available} total={metrics.seats.total} />}
            <div className='grid grid-cols-2 gap-2 text-xs text-center'>
              {[{label:'Available',value:metrics?.seats.available??0},{label:'Utilisation',value:`${metrics?.seats.utilizationPct??0}%`}].map(({label,value})=>(
                <div key={label} className='py-2.5 rounded-xl' style={{ background:'rgba(255,255,255,0.04)' }}>
                  <p style={{ color:'rgba(255,255,255,0.35)' }}>{label}</p>
                  <p className='text-white font-bold mt-0.5'>{typeof value==='number'?fmt(value):value}</p>
                </div>
              ))}
            </div>
          </div>

        </div>

        <footer className='text-center text-[11px] pb-4' style={{ color:'rgba(255,255,255,0.18)' }}>
          {metrics?.timestamp?`Last server snapshot: ${new Date(metrics.timestamp).toLocaleString()}`:'—'}
          {' · '}Powered by Inngest + Upstash Redis + PostgreSQL
        </footer>
      </div>
    </main>
  );
}