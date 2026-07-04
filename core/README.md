# Ballast — Core

NestJS API, workers, scheduler, and reaper for Ballast. Phase 0 (foundation) is
in place: config validation, a Postgres connection pool + Drizzle, a health
probe with a real DB check, migration tooling, and tests.

## Stack

- Node 20 · TypeScript · NestJS 10
- Postgres (Supabase) via the `pg` driver + Drizzle ORM for schema/migrations
- Config validated with zod; request DTOs validated with class-validator
- Jest for unit tests; Testcontainers for integration tests

## Getting started

```bash
npm install
cp .env.example .env        # set DATABASE_URL to your Supabase connection string
npm run db:migrate          # apply migrations
npm run start:dev           # API + scheduler on http://localhost:3000
npm run start:worker:dev    # a worker process (run several for a fleet)
```

Check health:

```bash
curl -i http://localhost:3000/health
# 200 {"status":"ok","db":"up",...}   when the database is reachable
# 503 {"status":"error","db":"down",...} otherwise
```

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run start:dev` | Watch-mode dev server (tsx) |
| `npm run build` / `npm start` | Compile to `dist/` and run |
| `npm run lint` / `npm run format` | ESLint / Prettier |
| `npm test` | Unit tests (no external services) |
| `npm run test:int` | Integration tests — **requires Docker** (Testcontainers) |
| `npm run db:generate` | Generate a migration from `src/database/schema.ts` |
| `npm run db:migrate` | Apply pending migrations (needs `DATABASE_URL`) |
| `npm run db:seed-demo` | Create the reviewer demo account (`demo@ballast.dev` / `ballast-demo`) |

## API

| Method & path | Auth | Purpose |
| ------------- | ---- | ------- |
| `GET /health` | — | Liveness + DB readiness |
| `POST /api/v1/auth/signup` | — | Create org + owner (seeds a default project, retry policy, and queue) |
| `POST /api/v1/auth/login` | — | Return the account and access/refresh tokens |
| `POST /api/v1/auth/refresh` | — | Exchange a refresh token for a new pair |
| `GET /api/v1/me` | Bearer | The authenticated user and their org |
| `POST /api/v1/jobs` | Bearer | Submit a job (immediate, delayed, or cron) |
| `GET /api/v1/jobs` | Bearer | List jobs (filter by status/type/queue + paginate) |
| `GET /api/v1/jobs/:id` | Bearer | Get a job |
| `GET /api/v1/jobs/:id/attempts` | Bearer | Attempt history |
| `POST /api/v1/jobs/:id/retry` | Bearer | Replay a failed/dead job |
| `GET /api/v1/queues` | Bearer | Queues with per-status stats |
| `GET /api/v1/retry-policies` | Bearer | Retry policies in the org |
| `GET /api/v1/workers` | Bearer | Live worker fleet (heartbeats, in-flight) |
| `GET /api/v1/overview` | Bearer | Dashboard stats (status counts, 24h throughput, success rate) |
| `GET /api/v1/advisories` | Bearer | AI advisories (written by the Phase 6 service) |
| `POST /api/v1/advisories/:id/ack` | Bearer | Acknowledge an advisory |

Responses match the web dashboard's `types/api.ts` contract.

## Layout

```
src/
  config/      validated environment (zod)
  database/    pg Pool + Drizzle providers, schema, migrations, migrate runner
  health/      GET /health with a DB round-trip check
  auth/        signup/login/refresh, JWT tokens, guard, /me
  jobs/        submission API, state machine, cron util
  queues/      GET /queues with per-status stats
  scheduler/   promoter: scheduled/cron jobs → ready
  reaper/      returns expired-lease (crashed) jobs to ready/dead
  worker/      claim engine (raw SQL), backoff, handlers, worker loop
  fleet/       GET /workers
  overview/    dashboard stats
  advisories/  read AI advisories (written by the Phase 6 service)
  main.ts      API + scheduler bootstrap
  worker.ts    worker process bootstrap
test/          Testcontainers integration tests
```

## Notes

- Use the Supabase **session-mode pooler (5432)** or the **direct connection** —
  not the transaction pooler (6543), which lacks session features the worker's
  `LISTEN/NOTIFY` path needs later.
- The pool is intentionally small (free-tier connection limits).
- `enableShutdownHooks()` drains the pool on SIGTERM for graceful shutdown.
