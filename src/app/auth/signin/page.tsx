'use client';
// src/app/auth/signin/page.tsx
// Sign-in page — Google OAuth button + email/password form.

import { useState, useEffect } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const callbackUrl = params.get("callbackUrl") ?? "/events";
  const errorParam  = params.get("error");

  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);

  // Map every possible NextAuth error code to a human-readable message.
  function resolveError(code: string | null): string {
    if (!code) return "";
    const map: Record<string, string> = {
      CredentialsSignin:    "Invalid email or password. If you signed up with Google, use the button below.",
      OAuthSignin:          "Could not start Google sign-in. Please try again.",
      OAuthCallback:        "Google sign-in failed — the redirect URI may not be configured in Google Cloud Console. Ask the admin to add: https://surgeshield-xi.vercel.app/api/auth/callback/google",
      OAuthCreateAccount:   "Could not create an account with Google. Please try email sign-up.",
      Callback:             "Sign-in callback error. Please try again or use email/password.",
      AccessDenied:         "Access was denied. You may not have permission to sign in.",
      Verification:         "The sign-in link has expired. Please request a new one.",
      Configuration:        "Server configuration error. Please contact support.",
      Default:              "An unexpected sign-in error occurred. Please try again.",
    };
    return map[code] ?? `Sign-in error: ${code}. Please try again.`;
  }

  const [error, setError] = useState(resolveError(errorParam));

  // Clear the ?error= param from the URL after reading it so that
  // refreshing the page doesn't show a stale error from a previous attempt.
  useEffect(() => {
    if (errorParam) {
      const clean = new URL(window.location.href);
      clean.searchParams.delete("error");
      router.replace(clean.pathname + (clean.search || ""), { scroll: false });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError("Please fill in all fields."); return; }
    setLoading(true); setError("");
    const res = await signIn("credentials", {
      email, password, redirect: false,
    });
    setLoading(false);
    if (res?.error) {
      // Check if the account exists but was created via Google OAuth (no password)
      setError("Invalid email or password. If you signed up with Google, use the \"Continue with Google\" button above.");
      return;
    }
    router.push(callbackUrl);
  }

  async function handleGoogle() {
    setLoading(true);
    await signIn("google", { callbackUrl });
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
          <h1 className="text-2xl font-bold text-white">Welcome back</h1>
          <p className="text-slate-500 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="glass rounded-3xl p-7 space-y-5">
          {error && (
            <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-xl"
              style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171" }}>
              ⚠️ {error}
            </div>
          )}

          {/* Google */}
          <button
            onClick={handleGoogle}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl font-medium text-sm transition-all hover:bg-white/10 disabled:opacity-50"
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          <div className="flex items-center gap-3">
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
            <span className="text-[11px] text-slate-600 uppercase tracking-widest">or</span>
            <div className="flex-1 h-px" style={{ background: "rgba(255,255,255,0.08)" }} />
          </div>

          {/* Credentials */}
          <form onSubmit={handleCredentials} className="space-y-4" noValidate>
            <div>
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500 mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="jane@example.com"
                disabled={loading}
                className="input-dark"
                autoComplete="email"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-semibold uppercase tracking-widest text-slate-500">
                Password
              </label>
              <Link
                href="/auth/forgot-password"
                className="text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                Forgot password?
              </Link>
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="input-dark"
              autoComplete="current-password"
            />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full py-3">
              {loading
                ? <><Spinner />Signing in…</>
                : "Sign in →"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-slate-500 mt-6">
          Don&apos;t have an account?{" "}
          <Link href="/auth/signup" className="text-indigo-400 hover:text-indigo-300 font-medium">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}

function Spinner() {
  return (
    <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent animate-spin" />
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#EA4335" d="M9 3.48c1.69 0 2.83.73 3.48 1.34l2.54-2.48C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.96l2.91 2.26C4.6 5.05 6.62 3.48 9 3.48z"/>
      <path fill="#4285F4" d="M17.64 9.2c0-.74-.06-1.28-.19-1.84H9v3.34h4.96c-.1.83-.65 2.08-1.88 2.92l2.88 2.23c1.7-1.57 2.68-3.88 2.68-6.65z"/>
      <path fill="#FBBC05" d="M3.88 10.78A5.54 5.54 0 0 1 3.58 9c0-.62.11-1.22.29-1.78L.96 4.96A9.008 9.008 0 0 0 0 9c0 1.45.35 2.82.96 4.04l2.92-2.26z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.88-2.23c-.76.53-1.78.9-3.08.9-2.38 0-4.4-1.57-5.12-3.74L.97 13.04C2.45 15.98 5.48 18 9 18z"/>
    </svg>
  );
}
