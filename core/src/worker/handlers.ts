import type { JobTypeValue } from '../database/schema';

type JobHandler = (payload: Record<string, unknown>) => Promise<unknown>;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Handlers for the five job types. They simulate side-effecting work so the
 * engine can be exercised end to end without real external services. A payload
 * flag `simulateFailure: true` makes a handler throw, for testing the failure
 * path and (later) retries.
 */
const HANDLERS: Record<JobTypeValue, JobHandler> = {
  http_request: async (p) => {
    await sleep(40 + Math.random() * 80);
    return { status: 200, url: p.url ?? null };
  },
  email: async (p) => {
    await sleep(30 + Math.random() * 50);
    return { delivered: true, to: p.to ?? null };
  },
  data_export: async (p) => {
    await sleep(60 + Math.random() * 120);
    return { dataset: p.dataset ?? null, rows: Math.floor(Math.random() * 5000) };
  },
  image_transform: async (p) => {
    await sleep(50 + Math.random() * 100);
    return { width: p.width ?? null, height: p.height ?? null };
  },
  report: async (p) => {
    await sleep(80 + Math.random() * 150);
    return { reportKind: p.reportKind ?? null, url: 's3://reports/out.pdf' };
  },
};

export async function runJob(
  type: JobTypeValue,
  payload: Record<string, unknown>,
): Promise<unknown> {
  if (payload.simulateFailure === true) {
    throw new Error('Simulated job failure');
  }
  const handler = HANDLERS[type];
  if (!handler) throw new Error(`No handler registered for job type "${type}"`);
  return handler(payload);
}
