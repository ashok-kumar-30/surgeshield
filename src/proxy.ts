// src/middleware.ts
//
// Edge middleware that guards role-restricted routes.
// Runs before the page renders — zero DB round-trips (JWT-based check).

import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const role = req.auth?.user?.role;

  // Organizer portal — ORGANIZER or ADMIN only
  if (pathname.startsWith("/organizer")) {
    if (role !== "ORGANIZER" && role !== "ADMIN") {
      const signIn = new URL("/auth/signin", req.url);
      signIn.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(signIn);
    }
  }

  // Admin dashboard — ADMIN only
  if (pathname.startsWith("/admin")) {
    if (role !== "ADMIN") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }
});

export const config = {
  matcher: ["/organizer/:path*", "/admin/:path*"],
};
