'use client';
// src/components/providers.tsx
// Wraps children in the NextAuth SessionProvider so any client component
// can call useSession() without additional setup.

import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
