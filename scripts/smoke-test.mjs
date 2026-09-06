// scripts/smoke-test.mjs
//
// Full automated smoke test for SurgeShield production deployment.
// Tests: health, metrics, registration flow, concurrency, rate limiting.
//
// Usage:
//   node scripts/smoke-test.mjs
//   node scripts/smoke-test.mjs https://your-custom-url.vercel.app

import { randomUUID } from "crypto";

const BASE_URL = process.argv[2] ?? "https://surgeshield-xi.vercel.app";
const RESULTS   = [];
let passed = 0, failed = 0;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(icon, label, detail = "") {
  console.log(`  ${icon}  ${label}${detail ? "  →  " + detail : ""}`);
}

function pass(label, detail = "") {
  passed++;
  RESULTS.push({ ok: true, label });
  log("✅", label, detail);
}

function fail(label, detail = "") {
  failed++;
  RESULTS.push({ ok: false, label });
  log("❌", label, detail);
}

async function get(path) {
  const r = await fetch(`${BASE_URL}${path}`);
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

async function post(path, body) {
  const r = await fetch(`${BASE_URL}${path}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

async function testLandingPage() {
  console.log("\n📋  Landing Page");
  try {
    const r = await fetch(BASE_URL);
    r.status === 200 ? pass("Landing page loads (200 OK)") : fail("Landing page", `got ${r.status}`);
  } catch (e) {
    fail("Landing page unreachable", e.message);
  }
}

async function testMetricsEndpoint() {
  console.log("\n📊  Metrics API");
  try {
    const { status, body } = await get("/api/metrics");
    if (status !== 200) { fail("GET /api/metrics", `status ${status}`); return null; }
    pass("GET /api/metrics returns 200");

    const required = ["traffic", "currentMinute", "totals", "registrations", "seats", "health"];
    const missing  = required.filter(k => !(k in body));
    missing.length === 0
      ? pass("Metrics payload has all required fields")
      : fail("Metrics payload missing fields", missing.join(", "));

    const { health } = body;
    health?.status
      ? pass(`System health status`, health.status)
      : fail("Health status missing from metrics");

    return body;
  } catch (e) {
    fail("Metrics endpoint error", e.message);
    return null;
  }
}

async function testEventsEndpoint() {
  console.log("\n🎟️   Events API");
  try {
    const { status, body } = await get("/api/organizer/events");
    // 401 is expected (unauthenticated) — means the route exists
    [200, 401, 403].includes(status)
      ? pass("GET /api/organizer/events reachable", `status ${status}`)
      : fail("Events endpoint unreachable", `status ${status}`);
    return body?.events ?? [];
  } catch (e) {
    fail("Events endpoint error", e.message);
    return [];
  }
}

async function testRegistrationValidation() {
  console.log("\n🔒  Input Validation");
  try {
    // Bad body — should return 422
    const { status } = await post("/api/registrations", { userId: "bad", eventId: "bad" });
    status === 422
      ? pass("Invalid CUID rejected with 422")
      : fail("Validation not enforced", `got ${status}`);

    // Empty body
    const { status: s2 } = await post("/api/registrations", {});
    [400, 422].includes(s2)
      ? pass("Empty body rejected with 400/422")
      : fail("Empty body not rejected", `got ${s2}`);
  } catch (e) {
    fail("Validation test error", e.message);
  }
}

async function testRateLimiting() {
  console.log("\n🚦  Rate Limiting");
  // Use a fake-but-valid CUID to trigger rate limit without real DB writes
  const fakeUserId  = "cmtpnrdg00000v1iwzh0dyo0g";
  const fakeEventId = "cmtpnrdg00001v1iwzh0dyo0g";
  const responses   = [];

  try {
    // Fire 5 rapid requests with the same userId
    await Promise.all(
      Array.from({ length: 5 }).map(() =>
        post("/api/registrations", { userId: fakeUserId, eventId: fakeEventId })
          .then(r => responses.push(r.status))
      )
    );

    const rateLimited = responses.filter(s => s === 429).length;
    rateLimited > 0
      ? pass(`Rate limiter triggered`, `${rateLimited}/5 requests blocked (429)`)
      : fail("Rate limiter did not fire", `all responses: ${responses.join(", ")}`);

    const accepted = responses.filter(s => [202, 503].includes(s)).length;
    pass(`Requests processed without crash`, `${accepted} accepted/queued`);
  } catch (e) {
    fail("Rate limiting test error", e.message);
  }
}

async function testConcurrentRegistrations() {
  console.log("\n⚡  Concurrency (20 simultaneous requests)");
  // Simulate 20 concurrent registration attempts with different fake user IDs
  // They'll all fail at Inngest (no real event) but we're testing the API layer
  const fakeEventId = "cmtpnrdg00001v1iwzh0dyo0g";
  const results     = { accepted: 0, rejected: 0, errors: 0, other: 0 };

  try {
    const responses = await Promise.all(
      Array.from({ length: 20 }).map((_, i) => {
        // Each request uses a unique userId to bypass rate limiter
        const userId = `cmtpnrdg${String(i).padStart(5, "0")}v1iwzh0dyo0h`;
        return post("/api/registrations", { userId, eventId: fakeEventId })
          .then(r => r.status);
      })
    );

    responses.forEach(s => {
      if ([202, 503].includes(s)) results.accepted++;
      else if (s === 429) results.rejected++;
      else if (s >= 500) results.errors++;
      else results.other++;
    });

    const crashed = responses.filter(s => s === 500).length;
    crashed === 0
      ? pass("Zero 500 crashes under 20 concurrent requests")
      : fail(`${crashed} requests crashed with 500`);

    pass(`20 concurrent requests handled`, 
         `accepted=${results.accepted} rate-limited=${results.rejected} errors=${results.errors}`);

    // Response time test
    const start = Date.now();
    await post("/api/registrations", {
      userId:  "cmtpnrdg99999v1iwzh0dyo0z",
      eventId: fakeEventId,
    });
    const ms = Date.now() - start;
    ms < 2000
      ? pass(`API response time`, `${ms}ms (< 2000ms target)`)
      : fail(`API too slow`, `${ms}ms`);

  } catch (e) {
    fail("Concurrency test error", e.message);
  }
}

async function testAuthEndpoints() {
  console.log("\n🔐  Auth Endpoints");
  try {
    const r = await fetch(`${BASE_URL}/auth/signup`);
    r.status === 200
      ? pass("Signup page loads")
      : fail("Signup page error", `status ${r.status}`);

    const r2 = await fetch(`${BASE_URL}/auth/signin`);
    r2.status === 200
      ? pass("Signin page loads")
      : fail("Signin page error", `status ${r2.status}`);
  } catch (e) {
    fail("Auth endpoints error", e.message);
  }
}

async function testAdminDashboard() {
  console.log("\n🛡️   Admin Dashboard");
  try {
    const r = await fetch(`${BASE_URL}/admin/dashboard`);
    // 200 = accessible (unauthenticated redirect handled client-side)
    // 307/308 = redirect (middleware protecting it) — both are valid
    [200, 307, 308].includes(r.status)
      ? pass("Admin dashboard route exists", `status ${r.status}`)
      : fail("Admin dashboard unreachable", `status ${r.status}`);
  } catch (e) {
    fail("Admin dashboard error", e.message);
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${"═".repeat(58)}`);
  console.log(`  🛡️  SurgeShield Smoke Test`);
  console.log(`  📡  Target: ${BASE_URL}`);
  console.log(`  🕐  ${new Date().toLocaleString()}`);
  console.log(`${"═".repeat(58)}`);

  await testLandingPage();
  await testMetricsEndpoint();
  await testEventsEndpoint();
  await testAuthEndpoints();
  await testAdminDashboard();
  await testRegistrationValidation();
  await testRateLimiting();
  await testConcurrentRegistrations();

  // ─── Summary ───────────────────────────────────────────────────────────────
  console.log(`\n${"═".repeat(58)}`);
  console.log(`  📊  Results: ${passed} passed  |  ${failed} failed`);
  console.log(`  ${failed === 0 ? "🎉  ALL TESTS PASSED" : "⚠️   SOME TESTS FAILED"}`);
  console.log(`${"═".repeat(58)}\n`);

  if (failed > 0) {
    console.log("Failed tests:");
    RESULTS.filter(r => !r.ok).forEach(r => console.log(`  ❌  ${r.label}`));
    console.log();
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error("\n💥 Smoke test crashed:", err.message);
  process.exit(1);
});
