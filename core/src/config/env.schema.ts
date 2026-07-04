import { z } from 'zod';

/**
 * Environment contract for the core service. All external configuration is
 * validated here at boot so the app fails fast on misconfiguration rather than
 * at first use.
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  /** Comma-separated allowed CORS origins for the dashboard. */
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  /**
   * Postgres connection string. Use the Supabase session-mode pooler (5432) or
   * the direct connection — the transaction pooler (6543) lacks the session
   * features the worker's LISTEN/NOTIFY path needs.
   */
  DATABASE_URL: z.string().url(),

  // Separate secrets so a leaked access token can't be replayed as a refresh
  // token. Keep these out of source — env only.
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),

  // How often the promoter moves due scheduled/cron jobs into `ready`.
  SCHEDULER_INTERVAL_MS: z.coerce.number().int().positive().default(1000),
  // How often the reaper returns expired-lease (crashed) jobs to `ready`.
  REAPER_INTERVAL_MS: z.coerce.number().int().positive().default(5000),

  // Worker tuning.
  WORKER_CONCURRENCY: z.coerce.number().int().positive().default(10),
  WORKER_POLL_INTERVAL_MS: z.coerce.number().int().positive().default(500),
  LEASE_DURATION_MS: z.coerce.number().int().positive().default(30000),
  HEARTBEAT_INTERVAL_MS: z.coerce.number().int().positive().default(10000),
  // Comma-separated queue names this worker serves (cosmetic/fleet display).
  WORKER_QUEUES: z.string().default('default'),
});

export type Env = z.infer<typeof envSchema>;

/** Validate raw process.env; throws a readable error listing every problem. */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
