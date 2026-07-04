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
npm run db:migrate          # apply migrations (no-op until Phase 1 adds tables)
npm run start:dev           # http://localhost:3000
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

## Layout

```
src/
  config/      validated environment (zod)
  database/    pg Pool + Drizzle providers, migrations, migrate runner
  health/      GET /health with a DB round-trip check
  main.ts      bootstrap: global validation, shutdown hooks
test/          Testcontainers integration tests
```

## Notes

- Use the Supabase **session-mode pooler (5432)** or the **direct connection** —
  not the transaction pooler (6543), which lacks session features the worker's
  `LISTEN/NOTIFY` path needs later.
- The pool is intentionally small (free-tier connection limits).
- `enableShutdownHooks()` drains the pool on SIGTERM for graceful shutdown.
