# Ballast — Testing the whole flow

How to run Ballast end-to-end and exercise every part of the system before the
AI service (Phase 6) lands.

## Prerequisites

- Node 20+
- A Supabase (or any Postgres) connection string in `core/.env` as `DATABASE_URL`
  (use the **session pooler** URL, port 5432 — not the transaction pooler).
- Docker Desktop — only needed for the integration tests (`npm run test:int`).

## One-time setup

```bash
# core
cd core
cp .env.example .env            # set DATABASE_URL + JWT secrets
npm install
npm run db:migrate              # applies all migrations
npm run db:seed-demo            # creates the reviewer demo account (idempotent)

# web
cd ../web
npm install
echo "VITE_USE_MOCKS=false" > .env   # talk to the real core
```

## Run the stack (3 terminals)

```bash
# 1) API + scheduler + reaper
cd core && npm run start:dev            # http://localhost:3000

# 2) a worker FOR YOUR ORG (workers are org-scoped). Find your org id via
#    GET /api/v1/me, or from the `npm run db:seed-demo` output.
cd core && WORKER_ORG_ID=<your-org-id> npm run start:worker:dev

# 3) dashboard
cd web && npm run dev                   # http://localhost:5173
```

## Manual end-to-end flow

1. **Landing** — open http://localhost:5173. You get the marketing page.
2. **Auth** — the login screen is **prefilled with the reviewer demo account**
   (`demo@ballast.dev` / `ballast-demo`), so just click *Sign in*. Or click
   *Get started* to create your own workspace (org + seeded default queue). You
   land on `/app`.
3. **Submit a job** — Jobs → *New job* → pick the `default` queue and a type →
   *Submit*. It appears as `ready`.
4. **Watch it run** — within a second the worker claims it; the row goes
   `running` → `completed`. Open the job to see its attempt history.
5. **Overview** — the dashboard shows throughput, success rate, and active
   workers, refreshing as jobs complete.
6. **Fleet** — the Fleet page lists your org's worker(s) with live heartbeats
   and in-flight counts. Workers are org-scoped: a worker only runs the jobs of
   the org in its `WORKER_ORG_ID`, and each account sees only its own fleet.

## Exercise reliability

- **Retries + dead-letter** — submit a job with payload
  `{ "simulateFailure": true }` and `maxAttempts: 2`. Watch it go
  `running → (backoff) → running → dead`, then find it on the **Dead-letter**
  page and **Replay** it.
- **Delayed / cron** — submit with a *Run at* time or a cron expression; it sits
  on the **Scheduled** page until the promoter makes it `ready`.
- **Graceful shutdown** — `Ctrl-C` a worker; it logs "Draining … before exit",
  finishes in-flight jobs, and goes offline.
- **Crash recovery (preview of Phase 7)** — with two workers running, submit
  many jobs and `kill -9` one worker. Its in-flight jobs' leases expire and the
  reaper returns them to `ready`; another worker finishes them. Nothing runs
  twice.

## Automated tests

```bash
# core — unit tests (no services needed)
cd core && npm test

# core — integration tests (Testcontainers; needs Docker)
cd core && npm run test:int
#   ↳ exactly-once under concurrent claims, per-queue concurrency limits,
#     retry/backoff, dead-letter, the reaper, and the auth + job-submission flows.

# web — component/unit tests
cd web && npm test

# ai — advisory-logic unit tests (no DB or network)
cd ai && pip install -r requirements.txt && pytest
```

## AI advisories (optional)

The Python advisory service analyzes failures and writes advisories the
dashboard renders. It's advisory and asynchronous — the core runs fine without it.

```bash
cd ai
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env                 # set DATABASE_URL; ANTHROPIC_API_KEY optional
uvicorn app.main:app --port 8000     # background loop + POST /analyze
```

With a demo account that has dead-lettered jobs, `curl -X POST localhost:8000/analyze`
writes an advisory that appears on the dashboard's **AI Advisories** page. Set
`ANTHROPIC_API_KEY` to have Claude write them; without it a deterministic
template does, so the pipeline still runs.

CI (GitHub Actions) runs all of the above on every push.

## Verifying the invariants

| Invariant | Where to see it |
| --------- | --------------- |
| Exactly-once (`SKIP LOCKED`) | `core/src/worker/claim.service.ts`; `test/claim.int-spec.ts` |
| Crash recovery via leases + reaper | `core/src/reaper/reaper.service.ts`; `test/reliability.int-spec.ts` |
| Graceful shutdown (SIGTERM drain) | `core/src/worker/worker.service.ts` |
| Per-queue concurrency limits | `claim.service.ts` advisory locks; `claim.int-spec.ts` |
| AI is advisory/async | no AI on the claim path; advisories are DB rows served read-only |
