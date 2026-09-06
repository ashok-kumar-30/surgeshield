// src/app/api/auth/[...nextauth]/route.ts
// Exposes all NextAuth.js HTTP handlers (GET for session/CSRF, POST for signIn/signOut).
import { handlers } from "@/lib/auth";
export const { GET, POST } = handlers;