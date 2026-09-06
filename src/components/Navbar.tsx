'use client';
// src/components/Navbar.tsx
// Role-aware navigation bar. Shows organizer and admin links conditionally.

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState } from "react";
import Image from "next/image";

export function Navbar() {
  const { data: session, status } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);

  const role = session?.user?.role;
  const isOrganizer = role === "ORGANIZER" || role === "ADMIN";
  const isAdmin = role === "ADMIN";

  return (
    <nav
      className="sticky top-0 z-50 border-b"
      style={{
        background: "rgba(2,2,7,0.8)",
        borderColor: "rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)",
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-lg transition-transform group-hover:scale-110"
              style={{ background: "linear-gradient(135deg, #6366f1, #8b5cf6)" }}
            >
              🛡️
            </div>
            <span className="font-bold text-sm tracking-wide text-gradient hidden sm:block">
              SurgeShield
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            <NavLink href="/events">Events</NavLink>
            {isOrganizer && (
              <NavLink href="/organizer/events/new">+ Create Event</NavLink>
            )}
            {isAdmin && (
              <NavLink href="/admin/dashboard">Dashboard</NavLink>
            )}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            {status === "loading" ? (
              <div className="w-20 h-8 rounded-lg animate-pulse" style={{ background: "rgba(255,255,255,0.06)" }} />
            ) : session ? (
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(!menuOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all hover:bg-white/5"
                >
                  {session.user?.image ? (
                    <Image
                      src={session.user.image}
                      alt="avatar"
                      width={28}
                      height={28}
                      className="rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>
                      {session.user?.name?.[0]?.toUpperCase() ?? "U"}
                    </div>
                  )}
                  <span className="text-sm text-slate-300 max-w-[120px] truncate hidden sm:block">
                    {session.user?.name ?? session.user?.email}
                  </span>
                  {role && role !== "ATTENDEE" && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold hidden sm:block"
                      style={{
                        background: isAdmin ? "rgba(239,68,68,0.15)" : "rgba(99,102,241,0.15)",
                        color: isAdmin ? "#f87171" : "#a5b4fc",
                        border: `1px solid ${isAdmin ? "rgba(239,68,68,0.3)" : "rgba(99,102,241,0.3)"}`,
                      }}>
                      {role}
                    </span>
                  )}
                  <ChevronIcon />
                </button>

                {menuOpen && (
                  <div
                    className="absolute right-0 mt-2 w-48 rounded-2xl py-1 shadow-2xl"
                    style={{ background: "rgba(15,15,25,0.95)", border: "1px solid rgba(255,255,255,0.1)" }}
                  >
                    <DropdownLink href="/events" onClick={() => setMenuOpen(false)}>Browse Events</DropdownLink>
                    {isOrganizer && (
                      <DropdownLink href="/organizer/events/new" onClick={() => setMenuOpen(false)}>
                        ✨ Create Event
                      </DropdownLink>
                    )}
                    {isAdmin && (
                      <DropdownLink href="/admin/dashboard" onClick={() => setMenuOpen(false)}>
                        📊 Ops Dashboard
                      </DropdownLink>
                    )}
                    <div className="my-1 border-t" style={{ borderColor: "rgba(255,255,255,0.07)" }} />
                    <button
                      onClick={() => { setMenuOpen(false); void signOut({ callbackUrl: "/" }); }}
                      className="w-full text-left px-4 py-2 text-sm text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                      Sign out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <>
                <Link href="/auth/signin" className="btn-ghost text-xs px-4 py-2">
                  Sign in
                </Link>
                <Link href="/auth/signup" className="btn-primary text-xs px-4 py-2">
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="px-3 py-2 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all"
    >
      {children}
    </Link>
  );
}

function DropdownLink({ href, onClick, children }: { href: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="block px-4 py-2 text-sm text-slate-300 hover:text-white hover:bg-white/5 transition-colors"
    >
      {children}
    </Link>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="opacity-40">
      <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
