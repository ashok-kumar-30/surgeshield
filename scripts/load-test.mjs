// scripts/load-test.mjs
//
// SurgeShield Load Test — demonstrates autoscaling under surge conditions.
//
// BEFORE RUNNING:
//   1. npm run dev           (in terminal 1)
//   2. npx inngest-cli dev   (in terminal 2, optional but shows jobs processing)
//   3. Open https://surgeshield-xi.vercel.app/admin/dashboard  (watch the sparklines live)
//   4. node scripts/load-test.mjs [preset]
//
// PRESETS:
//   node scripts/load-test.mjs gentle    --  20 users,  1 wave  (safe demo)
//   node scripts/load-test.mjs surge     -- 100 users,  3 waves (main demo)
//   node scripts/load-test.mjs storm     -- 300 users,  5 waves (stress test)

import { randomBytes } from "crypto";

// ─── Config ──────────────────────────────────────────────────────────────────

const BASE_URL      = process.env.BASE_URL ?? "http://localhost:3000";
const PRESET        = process.argv[2] ?? "surge";
const EVENT_ID      = process.env.EVENT_ID; // optional: pass a real CUID

const PRESETS = {
  gentle: { users: 20,  waves: 1, delayMs: 500  },
  surge:  { users: 100, waves: 3, delayMs: 2000 },
  storm:  { users: 300, waves: 5, delayMs: 1000 },
};

const config = PRESETS[PRESET] ?? PRESETS.surge;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function cuid() {
  // Generate a fake-but-valid-looking CUID for load testing
  const ts  = Date.now().toString(36);
  const rnd = randomBytes(10).toString("base64url").slice(0, 14);
  return `c${ts}${rnd}`.slice(0, 25);
}

const stats = { accepted: 0, rejected: 0, failed: 0, total: 0 };

async function sendRegistration(userId, eventId) {
  try {
    const res = await fetch(`${BASE_URL}/api/registrations`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ userId, eventId }),
      signal:  AbortSignal.timeout(10_000),
    });

    stats.total++;

    if (res.status === 202) {
      stats.accepted++;
      process.stdout.write("✓");
    } else if (res.status === 429) {
      stats.rejected++;
      process.stdout.write("⊘");
    } else {
      stats.failed++;
      process.stdout.write("✗");
    }
  } catch {
    stats.failed++;
    stats.total++;
    process.stdout.write("!");
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function runWave(waveNum, eventId) {
  console.log(`\n\n⚡ Wave ${waveNum}/${config.waves} — firing ${config.users} concurrent requests…`);

  // Each user gets their own stable userId for this wave.
  // In a real surge, many users would share the same userId if they spam-click.
  const requests = Array.from({ length: config.users }, () =>
    sendRegistration(cuid(), eventId)
  );

  await Promise.allSettled(requests);
}

async function main() {
  const eventId = EVENT_ID ?? cuid(); // Use real event ID from your DB for a real test

  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SurgeShield Load Test");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Preset   : ${PRESET.toUpperCase()}`);
  console.log(`  Target   : ${BASE_URL}`);
  console.log(`  Users/wave: ${config.users}`);
  console.log(`  Waves    : ${config.waves}`);
  console.log(`  Event ID : ${eventId}`);
  console.log("───────────────────────────────────────────────────────────");
  console.log("  ✓ = 202 Accepted (queued)");
  console.log("  ⊘ = 429 Rate Limited (user sent too many)");
  console.log("  ✗ = Error");
  console.log("───────────────────────────────────────────────────────────");
  console.log("  👉 Watch: https://surgeshield-xi.vercel.app/admin/dashboard");
  console.log("═══════════════════════════════════════════════════════════");

  const startTime = Date.now();

  for (let w = 1; w <= config.waves; w++) {
    await runWave(w, eventId);
    if (w < config.waves) {
      process.stdout.write(`\n  ⏳ Waiting ${config.delayMs}ms before next wave…`);
      await new Promise(r => setTimeout(r, config.delayMs));
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log("\n\n═══════════════════════════════════════════════════════════");
  console.log("  RESULTS");
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Total requests : ${stats.total}`);
  console.log(`  ✅ Accepted    : ${stats.accepted} (queued for seat claim)`);
  console.log(`  ⊘  Rate-limited: ${stats.rejected} (sliding window triggered)`);
  console.log(`  ❌ Failed      : ${stats.failed}`);
  console.log(`  ⏱  Duration   : ${elapsed}s`);
  console.log(`  📊 RPS         : ${(stats.total / +elapsed).toFixed(0)} req/s`);
  console.log("───────────────────────────────────────────────────────────");
  console.log("  Now check the admin dashboard — you should see:");
  console.log("  • Green spike in the Accepted sparkline");
  console.log("  • Amber spike in the Rejected sparkline (rate limiting working)");
  console.log("  • Inngest dashboard processing all accepted jobs");
  console.log("═══════════════════════════════════════════════════════════");
}

main().catch(console.error);
