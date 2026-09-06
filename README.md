# SurgeShield

SurgeShield is a resilient, self-scaling event-registration platform designed to handle high-concurrency traffic spikes without database degradation.

## Architecture Highlights
- **Multi-Tier Stack:** Next.js (Frontend & Serverless APIs) + Inngest (Async Job Processing & Shock Absorber) + PostgreSQL (Neon) + Upstash Redis (Sliding-window Rate Limiting).
- **Resilience:** Immediate 202 Accepted ingestion, atomic seat reservations, and scale-to-zero serverless economics.

## AI Usage & Tooling Transparency
- Modern AI tooling (Cursor, Claude, ChatGPT) was utilized to generate boilerplate UI layouts, schema drafts, and baseline error-handling workflows.
- Core business logic, atomic SQL query rules, rate-limiting constraints, and asynchronous queue integrations were reviewed, tailored, and verified manually.
