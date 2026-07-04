# Ballast — Web Dashboard

The React dashboard for Ballast, the distributed job scheduler. Built
**frontend-first**: it runs today against a mock (MSW) backend that implements
the API contract in [`src/types/api.ts`](src/types/api.ts). When the core
NestJS API lands, the mock layer is removed and nothing else changes.

## Stack

- React 18 + TypeScript + Vite
- Tailwind CSS + shadcn/ui (Radix primitives)
- TanStack Query (server state) + React Router
- Recharts (visualizations)
- MSW (mock API during frontend-first development)

## Getting started

```bash
npm install
npm run dev      # http://localhost:5173  (MSW mock backend starts automatically)
```

### Run against the real core API

By default the app uses the MSW mock backend. To talk to the live core instead:

```bash
# 1. Start the core (in ../core): npm run start:dev   (and a worker: npm run start:worker:dev)
# 2. In web/.env:
echo "VITE_USE_MOCKS=false" > .env
npm run dev
```

In dev, Vite proxies `/api/v1` → `http://localhost:3000` (same-origin, no CORS).
The login screen is prefilled with the seeded demo account.

## Scripts

| Script | Purpose |
| ------ | ------- |
| `npm run dev` | Vite dev server with the MSW mock backend |
| `npm run build` | Type-check (`tsc -b`) + production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | Type-check only |
| `npm run format` | Prettier write |
| `npm test` | Run the Vitest suite once |
| `npm run test:watch` | Vitest in watch mode |

## Testing

Component and unit tests run on **Vitest + Testing Library** (jsdom). They cover
the interactive, reliability-relevant UI: the auth form wiring, the jobs table
(rendering, attempts, row selection), the status badges, and formatting helpers.

## Structure

```
src/
  app/          providers, router nav config
  components/   ui/ (shadcn primitives), layout/, charts/, domain components
  hooks/        TanStack Query hooks (read/write surface)
  lib/          typed API client, utils
  mocks/        MSW handlers + seeded in-memory DB (the swap-out point)
  pages/        route views
  types/        api.ts — the API contract (source of truth)
```

## The API contract

[`src/types/api.ts`](src/types/api.ts) defines every entity and the WebSocket
event schema. The frontend, the MSW mocks, and the future NestJS backend all
conform to it. The dashboard talks to `/api/v1/*`; today MSW answers those
requests (see [`src/mocks/handlers.ts`](src/mocks/handlers.ts)).
