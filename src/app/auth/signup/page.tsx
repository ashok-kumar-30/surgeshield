'use client';
// src/app/auth/signup/page.tsx
// Registration page — creates an account then auto-signs-in via credentials.

import { useState } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const defaultRole = (params.get("role") ?? "ATTENDEE") as "ATTENDEE" | "ORGANIZER";

  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [role,     setRole]     = useState<"ATTENDEE" | "ORGANIZER">(defaultRole);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !password) {
      setError("Please fill in all fields."); return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters."); return;
    }
    setLoading(true); setError("");

    // 1. Create the account
    const res = await fetch("/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim(), password, role }),
    });

    if (res.status === 409) { setLoading(false); setError("Email already registered. Sign in instead."); return; }
    if (!res.ok) {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setLoading(false); setError(d.error ?? "Signup failed. Please try again."); return;
    }

    // 2. Auto sign-in
    const login = await signIn("credentials", { email: email.trim(), password, redirect: false });
    setLoading(false);
    if (login?.error) { setError("Account created! Please sign in."); router.push("/auth/signin"); return; }
    router.push(role === "ORGANIZER" ? "/organizer/events/new" : "/events");
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4"
      style={{
        background: "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.15) 0%, transparent 60%), #020207",
      }}
    >
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-xl"
              style={{ background: "linear-gradient(135deg,#6366f1,#8b5cf6)" }}>🛡️</div>
            <span className="font-bold text-gradient">SurgeShield</span>
          </Link>
          <h1 className="text-2xl font-bold text-white">Create your account</h1>
          <p className="text-slate-500 text-sm mt-1">Free forever · No credit card required</p>
        </div>

        <div className="glass rounded-3xl p-7 space-y-5">
          {error && (
            <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Role picker */}
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-2">I want to…</p>
            <div className="grid grid-cols-2 gap-2">
              {(["ATTENDEE", "ORGANIZER"] as const).map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className="py-2.5 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: role === r ? "rgba(99,102,241,0.2)" : "rgba(255,255,255,0.04)",
                    border: role === r ? "1px solid rgba(99,102,241,0.5)" : "1px solid rgba(255,255,255,0.08)",
                    color: role === r ? "#a5b4fc" : "rgba(255,255,255,0.5)",
                  }}
                >
                  {r === "ATTENDEE" ? "🎫 Attend Events" : "🏟️ Host Events"}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {[
              { id: "name",     label: "Full Name",  type: "text",     value: name,     set: setName,     placeholder: "Jane Smith",        auto: "name"  },
              { id: "email",    label: "Email",       type: "email",    value: email,    set: setEmail,    placeholder: "jane@example.com",  auto: "email" },
              { id: "password", label: "Password",    type: "password", value: password, set: setPassword, placeholder: "Min. 8 characters", auto: "new-password" },
            ].map(f => (
              <div key={f.id}>
                <label htmlFor={f.id} className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                  {f.label}
                </label>
                <input
                  id={f.id}
                  type={f.type}
                  value={f.value}
                  onChange={e => f.set(e.target.value)}
                  placeholder={f.placeholder}
                  disabled={loading}
                  className="input-dark"
                  autoComplete={f.auto}
                />
              </div>
            ))}

            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading
                ? <><div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />Creating account…</>
                : `Create ${role === "ORGANIZER" ? "Organizer" : ""} Account →`}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Already have an account?{" "}
          <Link href="/auth/signin" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
