# Ballast — Roadmap (frontend-first)

Ballast is a distributed, exactly-once job scheduler. We are building it
**frontend-first**: the dashboard is developed against a typed API contract with
a mock (MSW) backend, then the real NestJS core is wired in without UI rewrites.

> The canonical build order in the project brief puts the dashboard at Phase 5.
> We front-load it deliberately, but keep it **contract-first** so the backend
> can drop in behind the same shapes. `web/src/types/api.ts` is the source of
> truth both sides build against.

## Frontend phases

| Phase | Scope | Status |
| ----- | ----- | ------ |
| **A — Foundation** | Vite + React 18 + TS + Tailwind + shadcn/ui, dark mode, API contract, MSW mock layer, app shell (sidebar/topbar/routing), Overview page with live charts | ✅ Done |
| **B — Auth UI** | Login / signup / refresh flows, JWT storage, protected routes, org switcher | ⬜ Planned |
| **C — Core views** | Jobs table (filter by state, job detail drawer with attempts), Queues (concurrency, retry policy, pause), Submit-job form (5 job types) | ⬜ Planned |
| **D — Reliability & live** | Scheduled/cron view, Dead-letter queue + replay, Fleet/workers (heartbeats, leases, in-flight), WebSocket live updates | ⬜ Planned |
| **E — AI advisory panel** | Insights/recommendations UI over mock advisories | ⬜ Planned |
| **F — Polish** | Empty/loading/error states, responsive, a11y, component tests (Vitest + Testing Library) | ⬜ Planned |

## Backend phases (per the original brief, after the frontend)

0. Foundation: scaffold `/core`, Supabase via `DATABASE_URL`, health check, Drizzle migrations, CI, Testcontainers
1. Data model + auth (orgs, users, projects, queues, retry policies; JWT)
2. Job submission + state machine (5 job types) + scheduler/promoter + cron
3. Claiming engine: `SKIP LOCKED`, leases, heartbeats, concurrency limits, graceful shutdown
4. Reliability: retries + backoff, dead-letter, reaper
5. **Wire the dashboard to the real API** (replace MSW with core endpoints)
6. AI advisory loop (separate Python service)
7. Chaos test + hardening (`kill -9` proves exactly-once)
8. Package + deploy

## Non-negotiable invariants (carried from the brief)

1. Exactly-once via `SELECT … FOR UPDATE SKIP LOCKED` (hand-written SQL).
2. Crash recovery via leases + a reaper.
3. Graceful shutdown on SIGTERM (drain in-flight).
4. Per-queue concurrency limits always respected.
5. AI is advisory and asynchronous — the system runs correctly with it off.

## The contract-first bet

The dashboard talks to `/api/v1/*`. Today those routes are served by MSW handlers
(`web/src/mocks/`). When Phase 5 of the backend lands, we delete the MSW startup
call in `web/src/main.tsx` and point at the real core — every response already
matches `web/src/types/api.ts`.
