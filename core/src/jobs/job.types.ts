import type { Job, JobAttempt } from '../database/schema';

/** Job shape returned by the API, matching the web `types/api.ts` contract. */
export interface JobDto {
  id: string;
  queueId: string;
  projectId: string;
  type: string;
  status: string;
  payload: Record<string, unknown>;
  priority: number;
  attempts: number;
  maxAttempts: number;
  scheduledFor: string | null;
  cron: string | null;
  leaseExpiresAt: string | null;
  claimedBy: string | null;
  lastError: string | null;
  result: unknown;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
}

export interface JobAttemptDto {
  id: string;
  jobId: string;
  attemptNumber: number;
  workerId: string | null;
  status: string;
  error: string | null;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

export interface Paginated<T> {
  data: T[];
  page: number;
  pageSize: number;
  total: number;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function toJobDto(job: Job): JobDto {
  return {
    id: job.id,
    queueId: job.queueId,
    projectId: job.projectId,
    type: job.type,
    status: job.status,
    payload: job.payload,
    priority: job.priority,
    attempts: job.attempts,
    maxAttempts: job.maxAttempts,
    scheduledFor: iso(job.scheduledFor),
    cron: job.cron,
    leaseExpiresAt: iso(job.leaseExpiresAt),
    claimedBy: job.claimedBy,
    lastError: job.lastError,
    result: job.result ?? null,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    startedAt: iso(job.startedAt),
    completedAt: iso(job.completedAt),
  };
}

export function toAttemptDto(attempt: JobAttempt): JobAttemptDto {
  return {
    id: attempt.id,
    jobId: attempt.jobId,
    attemptNumber: attempt.attemptNumber,
    workerId: attempt.workerId,
    status: attempt.status,
    error: attempt.error,
    startedAt: attempt.startedAt.toISOString(),
    finishedAt: attempt.finishedAt.toISOString(),
    durationMs: attempt.durationMs,
  };
}
