// src/lib/auth.ts
//
// NextAuth v5 configuration.
//
// Strategy: JWT sessions (stateless) — works equally well for both
// Credentials (email/password) and OAuth (Google) without requiring
// the Prisma session adapter, keeping the architecture simpler.
//
// OAuth signIn callback manually upserts the user into our DB so that
// Google accounts get a proper CUID and role alongside OAuth accounts
// managed by the adapter.

import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },

  providers: [
    // ── Google OAuth ───────────────────────────────────────────────────────
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ── Email / Password ───────────────────────────────────────────────────
    Credentials({
      name: "Email & Password",
      credentials: {
        email:    { label: "Email",    type: "email"    },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user?.password) return null; // OAuth-only account

        const valid = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        return valid ? user : null;
      },
    }),
  ],

  callbacks: {
    // ── OAuth: persist user to our DB on first sign-in ────────────────────
    async signIn({ user, account }) {
      if (account?.type === "oauth" && user.email) {
        const existing = await prisma.user.findUnique({
          where: { email: user.email },
        });

        if (!existing) {
          const created = await prisma.user.create({
            data: { email: user.email, name: user.name, image: user.image },
          });
          user.id = created.id;
        } else {
          user.id   = existing.id;
          (user as any).role = existing.role;
        }
      }
      return true;
    },

    // ── Encode userId + role into the JWT ─────────────────────────────────
    async jwt({ token, user }) {
      if (user) {
        token.sub  = user.id;
        token.role = (user as any).role ?? "ATTENDEE";
      }
      return token;
    },

    // ── Expose userId + role on the client-side session ───────────────────
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id   = token.sub!;
        session.user.role = (token.role as UserRole) ?? UserRole.ATTENDEE;
      }
      return session;
    },
  },

  pages: {
    signIn: "/auth/signin",
    error:  "/auth/signin",
  },
});
