import type { BackoffStrategyValue } from '../database/schema';

export interface BackoffPolicy {
  backoff: BackoffStrategyValue;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

/**
 * Delay before the next retry after `attempt` failures (1-based).
 *
 *   fixed        base
 *   linear       base × attempt
 *   exponential  base × 2^(attempt-1)
 *
 * The result is capped at maxDelayMs. With jitter, the delay is spread across
 * [50%, 100%] of the capped value to avoid thundering-herd retries. `rand` is
 * injectable for deterministic tests.
 */
export function computeBackoffMs(
  policy: BackoffPolicy,
  attempt: number,
  rand: () => number = Math.random,
): number {
  const n = Math.max(1, attempt);
  let delay: number;
  switch (policy.backoff) {
    case 'fixed':
      delay = policy.baseDelayMs;
      break;
    case 'linear':
      delay = policy.baseDelayMs * n;
      break;
    case 'exponential':
      delay = policy.baseDelayMs * 2 ** (n - 1);
      break;
  }

  delay = Math.min(delay, policy.maxDelayMs);
  if (policy.jitter) {
    delay = delay / 2 + rand() * (delay / 2);
  }
  return Math.round(delay);
}
