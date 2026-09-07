'use client';
// src/components/NavBar.tsx — Role-aware global navigation

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useState } from 'react';

const ROLE_PILL: Record<string,{label:string;color:string;bg:string}> = {
  ADMIN:     { label:'Admin',     color:'#f87171', bg:'rgba(239,68,68,0.15)'   },
  ORGANIZER: { label:'Organizer', color:'#fbbf24', bg:'rgba(245,158,11,0.15)'  },
  ATTENDEE:  { label:'Attendee',  color:'#818cf8', bg:'rgba(99,102,241,0.12)'  },
};

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const role = (session?.user as any)?.role as string | undefined;
  const roleCfg = role ? ROLE_PILL[role] ?? ROLE_PILL.ATTENDEE : null;

  if (pathname?.startsWith('/auth/')) return null;

  const links = [
    { href:'/events',               label:'🎫 Events',        always: true },
    { href:'/dashboard',            label:'My Tickets',       show: !!session },
    { href:'/organizer/dashboard',  label:'📊 My Events',     show: role==='ORGANIZER'||role==='ADMIN' },
    { href:'/organizer/events/new', label:'+ Create Event',   show: role==='ORGANIZER'||role==='ADMIN' },
    { href:'/admin/dashboard',      label:'⚡ Admin',         show: role==='ADMIN' },
  ].filter(l => l.always || l.show);

  return (
    <nav className="sticky top-0 z-50 border-b" style={{background:'rgba(2,2,7,0.85)',backdropFilter:'blur(20px)',borderColor:'rgba(255,255,255,0.07)'}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-base" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>🛡️</div>
          <span className="font-bold text-white text-sm hidden sm:block">SurgeShield</span>
        </Link>
        <div className="hidden sm:flex items-center gap-1">
          {links.map(l=>(
            <Link key={l.href} href={l.href} className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-200"
              style={{color:pathname===l.href?'#a5b4fc':'rgba(255,255,255,0.5)',background:pathname===l.href?'rgba(99,102,241,0.15)':'transparent'}}>
              {l.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {session ? (
            <div className="relative">
              <button onClick={()=>setOpen(v=>!v)} className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:bg-white/5" style={{border:'1px solid rgba(255,255,255,0.08)'}}>
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}>
                  {(session.user?.name??session.user?.email??'U')[0].toUpperCase()}
                </div>
                <span className="text-xs text-white hidden sm:block max-w-[100px] truncate">{session.user?.name ?? session.user?.email?.split('@')[0]}</span>
                {roleCfg && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full hidden sm:block" style={{background:roleCfg.bg,color:roleCfg.color}}>{roleCfg.label}</span>}
                <span className="text-xs" style={{color:'rgba(255,255,255,0.3)'}}>▾</span>
              </button>
              {open && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl overflow-hidden shadow-2xl z-50" style={{background:'rgba(12,12,20,0.98)',border:'1px solid rgba(255,255,255,0.1)'}}>
                  <div className="px-4 py-3 border-b" style={{borderColor:'rgba(255,255,255,0.07)'}}>
                    <p className="text-xs font-semibold text-white truncate">{session.user?.name ?? 'User'}</p>
                    <p className="text-[11px] truncate" style={{color:'rgba(255,255,255,0.35)'}}>{session.user?.email}</p>
                    {roleCfg && <span className="inline-block mt-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{background:roleCfg.bg,color:roleCfg.color}}>{roleCfg.label}</span>}
                  </div>
                  {links.map(l=>(<Link key={l.href} href={l.href} onClick={()=>setOpen(false)} className="block px-4 py-2.5 text-sm transition-colors hover:bg-white/5" style={{color:'rgba(255,255,255,0.7)'}}>{l.label}</Link>))}
                  <button onClick={()=>{ setOpen(false); signOut({callbackUrl:'/'}); }} className="w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-white/5 border-t" style={{color:'#f87171',borderColor:'rgba(255,255,255,0.07)'}}>Sign out</button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/signin" className="text-sm px-3 py-1.5 rounded-lg transition-all hover:bg-white/5" style={{color:'rgba(255,255,255,0.6)'}}>Sign in</Link>
              <Link href="/auth/signup" className="btn-primary text-sm px-4 py-1.5">Get started</Link>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
