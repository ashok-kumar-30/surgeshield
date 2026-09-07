/**
 * prisma/seed.ts
 * Run: npx tsx prisma/seed.ts
 *
 * Seeds the database with:
 *  - 1 ADMIN user
 *  - 1 ORGANIZER user
 *  - 10 diverse events (virtual + in-person, sold out, almost full, future)
 */

import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const now = new Date();
const d = (daysFromNow: number, hour = 10) => {
  const dt = new Date(now);
  dt.setDate(dt.getDate() + daysFromNow);
  dt.setHours(hour, 0, 0, 0);
  return dt;
};

async function main() {
  console.log("🌱 Starting seed...\n");

  // ── Users ──────────────────────────────────────────────────────────────────
  const adminPw = await bcrypt.hash("Admin@123", 10);
  const orgPw   = await bcrypt.hash("Org@12345", 10);

  const admin = await prisma.user.upsert({
    where:  { email: "admin@surgeshield.dev" },
    update: {},
    create: {
      email: "admin@surgeshield.dev",
      name:  "SurgeShield Admin",
      password: adminPw,
      role: UserRole.ADMIN,
    },
  });
  console.log(`✅ Admin: ${admin.email}`);

  const organizer = await prisma.user.upsert({
    where:  { email: "organizer@surgeshield.dev" },
    update: {},
    create: {
      email: "organizer@surgeshield.dev",
      name:  "TechConf Organizer",
      password: orgPw,
      role: UserRole.ORGANIZER,
    },
  });
  console.log(`✅ Organizer: ${organizer.email}\n`);

  // ── Events ─────────────────────────────────────────────────────────────────
  const events = [
    {
      title:         "SurgeShield Hackathon 2026 — Grand Finale",
      description:   "The ultimate hackathon to build resilient, self-scaling web platforms. Teams of 1-4. Prizes: ₹5L, ₹2L, ₹1L. Live demos, expert judging, networking with top engineers.",
      isVirtual:     false,
      location:      "IIT Bombay, Mumbai",
      startsAt:      d(7, 9),
      endsAt:        d(9, 18),
      totalSeats:    500,
      availableSeats: 142,
      isPublished:   true,
    },
    {
      title:         "React & Next.js 16 Deep Dive Workshop",
      description:   "Intensive 1-day workshop covering Next.js 16 App Router, Server Actions, streaming, Suspense, and production deployment patterns. Hands-on exercises with real code.",
      isVirtual:     true,
      meetingUrl:    "https://meet.google.com/placeholder",
      startsAt:      d(3, 10),
      endsAt:        d(3, 17),
      totalSeats:    200,
      availableSeats: 12,
      isPublished:   true,
    },
    {
      title:         "Cloud-Native Architecture Summit",
      description:   "Two-day summit on Kubernetes, serverless, edge computing, and distributed systems. Talks from Google, AWS, and Vercel engineers. Attendee-only networking dinner.",
      isVirtual:     false,
      location:      "Taj Lands End, Mumbai",
      startsAt:      d(14, 8),
      endsAt:        d(15, 18),
      totalSeats:    300,
      availableSeats: 0, // Sold out
      isPublished:   true,
    },
    {
      title:         "AI/ML for Engineers — Practical Bootcamp",
      description:   "Not theory — real implementations. Build a RAG pipeline, fine-tune an LLM, and deploy a model to production. Includes GPU compute credits and take-home projects.",
      isVirtual:     true,
      meetingUrl:    "https://zoom.us/placeholder",
      startsAt:      d(10, 9),
      endsAt:        d(12, 17),
      totalSeats:    150,
      availableSeats: 0, // Sold out — tests waitlist
      isPublished:   true,
    },
    {
      title:         "PostgreSQL Performance Masterclass",
      description:   "Query optimization, indexing strategies, EXPLAIN ANALYZE, partitioning, and pg_stat_statements. Bring your own slow queries — we'll fix them live.",
      isVirtual:     true,
      meetingUrl:    "https://meet.google.com/placeholder-pg",
      startsAt:      d(5, 14),
      endsAt:        d(5, 18),
      totalSeats:    100,
      availableSeats: 67,
      isPublished:   true,
    },
    {
      title:         "Startup Pitch Night — Bangalore Edition",
      description:   "10 early-stage startups, 5 minutes each, ₹50L seed investment on the line. Open to investors, founders, and ecosystem builders. Networking after pitches.",
      isVirtual:     false,
      location:      "91springboard, Koramangala, Bangalore",
      startsAt:      d(6, 18),
      endsAt:        d(6, 21),
      totalSeats:    250,
      availableSeats: 31,
      isPublished:   true,
    },
    {
      title:         "DevOps & Platform Engineering Conference",
      description:   "CI/CD best practices, internal developer platforms, GitOps, OpenTelemetry, and incident response. Real war stories from production. 20+ talks, 2 days.",
      isVirtual:     false,
      location:      "Hyatt Regency, Pune",
      startsAt:      d(21, 9),
      endsAt:        d(22, 18),
      totalSeats:    400,
      availableSeats: 289,
      isPublished:   true,
    },
    {
      title:         "TypeScript & Zod — Type-Safe Full Stack",
      description:   "End-to-end type safety: Zod schemas, tRPC, Prisma types, and runtime validation. One schema, all layers. Live coding session included.",
      isVirtual:     true,
      meetingUrl:    "https://teams.microsoft.com/placeholder",
      startsAt:      d(2, 11),
      endsAt:        d(2, 14),
      totalSeats:    80,
      availableSeats: 7, // Almost full
      isPublished:   true,
    },
    {
      title:         "Women in Tech Leadership Forum",
      description:   "Panel discussions, mentorship speed-dating, and keynotes from women leading engineering organizations at Flipkart, Razorpay, and CRED. All genders welcome.",
      isVirtual:     false,
      location:      "WeWork Galaxy, Bangalore",
      startsAt:      d(18, 9),
      endsAt:        d(18, 17),
      totalSeats:    200,
      availableSeats: 88,
      isPublished:   true,
    },
    {
      title:         "Open Source Contribution Sprint",
      description:   "Contribute to top open source projects — Next.js, Prisma, Inngest, or your favourite repo. Mentors from core teams available. Free lunch, swag, and certificates.",
      isVirtual:     false,
      location:      "Google Office, MG Road, Bangalore",
      startsAt:      d(30, 10),
      endsAt:        d(30, 18),
      totalSeats:    120,
      availableSeats: 103,
      isPublished:   true,
    },
  ];

  for (const ev of events) {
    const created = await prisma.event.create({
      data: { ...ev, organizerId: organizer.id },
    });
    const status = ev.availableSeats === 0 ? "🔴 SOLD OUT" : ev.availableSeats <= 15 ? "🟡 ALMOST FULL" : "🟢 OPEN";
    console.log(`${status}  ${created.title.substring(0, 55).padEnd(55)} [${ev.availableSeats}/${ev.totalSeats} seats]`);
  }

  console.log(`\n🎉 Seeded ${events.length} events!`);
  console.log("\n📋 Login credentials:");
  console.log("   Admin:     admin@surgeshield.dev     /  Admin@123");
  console.log("   Organizer: organizer@surgeshield.dev /  Org@12345");
  console.log("\n🌐 Visit: https://surgeshield-xi.vercel.app/events");
}

main()
  .catch(e => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => prisma.$disconnect());
