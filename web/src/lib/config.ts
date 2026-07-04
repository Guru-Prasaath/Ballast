/**
 * Runtime wiring. By default the app runs against the MSW mock backend so it
 * works standalone. Set `VITE_USE_MOCKS=false` (and, in production, `VITE_API_URL`)
 * to talk to the real core API. In dev the relative `/api/v1` base is proxied to
 * the core by Vite (see vite.config.ts), so no CORS is needed locally.
 */
export const API_BASE = import.meta.env.VITE_API_URL ?? '/api/v1'

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS !== 'false'
