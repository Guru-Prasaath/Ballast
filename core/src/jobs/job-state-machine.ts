import type { JobStatusValue } from '../database/schema';

/**
 * The job lifecycle as an explicit transition map. Every status change in the
 * system must be a legal edge here — the claim engine (Phase 3), retry/reaper
 * (Phase 4), and the promoter all go through this.
 *
 *   scheduled ─▶ ready ─▶ running ─▶ completed
 *                           └─▶ failed ─▶ ready   (retry with backoff)
 *                                    └─▶ dead     (attempts exhausted)
 *   dead ─▶ ready   (manual replay)
 */
export const JOB_TRANSITIONS: Record<JobStatusValue, readonly JobStatusValue[]> =
  {
    scheduled: ['ready'],
    ready: ['running'],
    running: ['completed', 'failed'],
    failed: ['ready', 'dead'],
    dead: ['ready'],
    completed: [],
  };

export class InvalidJobTransitionError extends Error {
  constructor(
    readonly from: JobStatusValue,
    readonly to: JobStatusValue,
  ) {
    super(`Illegal job transition: ${from} → ${to}`);
    this.name = 'InvalidJobTransitionError';
  }
}

export function canTransition(
  from: JobStatusValue,
  to: JobStatusValue,
): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}

export function assertTransition(
  from: JobStatusValue,
  to: JobStatusValue,
): void {
  if (!canTransition(from, to)) {
    throw new InvalidJobTransitionError(from, to);
  }
}

export function isTerminal(status: JobStatusValue): boolean {
  return JOB_TRANSITIONS[status].length === 0;
}
