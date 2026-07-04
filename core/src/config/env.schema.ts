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
  /**
   * Postgres connection string. Use the Supabase session-mode pooler (5432) or
   * the direct connection — the transaction pooler (6543) lacks the session
   * features the worker's LISTEN/NOTIFY path needs.
   */
  DATABASE_URL: z.string().url(),
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
