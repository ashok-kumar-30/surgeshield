// src/app/layout.tsx
// Root layout — wraps all pages with the session provider and persistent Navbar.

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Navbar } from "@/components/Navbar";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SurgeShield — Resilient Event Registration",
    template: "%s | SurgeShield",
  },
  description:
    "A high-concurrency event registration platform engineered to stay online under extreme traffic surges. Powered by Inngest, Upstash Redis, and PostgreSQL.",
  openGraph: {
    title: "SurgeShield",
    description: "Register for high-demand events without the crush.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-[#020207] text-white antialiased min-h-screen">
        <Providers>
          <Navbar />
          <main>{children}</main>
        </Providers>
      </body>
    </html>
  );
}
