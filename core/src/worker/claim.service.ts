import { Inject, Injectable } from '@nestjs/common';
import { Pool, PoolClient } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { computeBackoffMs } from '../jobs/backoff';
import type { BackoffStrategyValue } from '../database/schema';

export interface ClaimedJob {
  id: string;
  queueId: string;
  type: string;
  payload: Record<string, unknown>;
  attempts: number;
  maxAttempts: number;
}

/**
 * The claim/lease path — hand-written SQL over the raw pg pool, deliberately not
 * hidden behind the ORM (invariant #2).
 *
 * Exactly-once (invariant #1) comes from `SELECT … FOR UPDATE SKIP LOCKED`: the
 * atomic ready→running UPDATE only touches rows this transaction locked, and
 * concurrent claimers skip locked rows, so no two workers ever get the same job.
 *
 * Per-queue concurrency (invariant #5) is enforced with a per-queue transaction
 * advisory lock so the "count running / claim remaining capacity" step is
 * serialized per queue. Queues are locked in a stable order to avoid deadlocks;
 * different queues still claim in parallel across workers.
 */
@Injectable()
export class ClaimService {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async claim(
    workerId: string,
    maxToClaim: number,
    leaseMs: number,
  ): Promise<ClaimedJob[]> {
    if (maxToClaim <= 0) return [];
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const { rows: dueQueues } = await client.query<{
        queue_id: string;
        concurrency_limit: number;
      }>(
        `SELECT DISTINCT j.queue_id, q.concurrency_limit
           FROM jobs j
           JOIN queues q ON q.id = j.queue_id
          WHERE j.status = 'ready'
            AND j.available_at <= now()
            AND q.paused = false
          ORDER BY j.queue_id`,
      );

      const claimed: ClaimedJob[] = [];
      for (const queue of dueQueues) {
        if (claimed.length >= maxToClaim) break;

        // Serialize capacity accounting for this queue.
        await client.query(
          'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
          [queue.queue_id],
        );

        const {
          rows: [{ running }],
        } = await client.query<{ running: number }>(
          `SELECT count(*)::int AS running
             FROM jobs
            WHERE queue_id = $1 AND status = 'running'`,
          [queue.queue_id],
        );

        const capacity = Math.min(
          maxToClaim - claimed.length,
          queue.concurrency_limit - running,
        );
        if (capacity <= 0) continue;

        const { rows } = await client.query(
          `UPDATE jobs
              SET status = 'running',
                  claimed_by = $2,
                  lease_expires_at = now() + ($3::bigint * interval '1 millisecond'),
                  started_at = now(),
                  attempts = attempts + 1,
                  updated_at = now()
            WHERE id IN (
              SELECT id FROM jobs
               WHERE queue_id = $1
                 AND status = 'ready'
                 AND available_at <= now()
               ORDER BY priority DESC, available_at ASC
               FOR UPDATE SKIP LOCKED
               LIMIT $4
            )
            RETURNING id, queue_id, type, payload, attempts, max_attempts`,
          [queue.queue_id, workerId, leaseMs, capacity],
        );

        for (const r of rows) {
          claimed.push({
            id: r.id,
            queueId: r.queue_id,
            type: r.type,
            payload: r.payload,
            attempts: r.attempts,
            maxAttempts: r.max_attempts,
          });
        }
      }

      await client.query('COMMIT');
      return claimed;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Extend the lease on every job this worker is still running (heartbeat). */
  async extendLeases(workerId: string, leaseMs: number): Promise<number> {
    const res = await this.pool.query(
      `UPDATE jobs
          SET lease_expires_at = now() + ($2::bigint * interval '1 millisecond'),
              updated_at = now()
        WHERE claimed_by = $1 AND status = 'running'`,
      [workerId, leaseMs],
    );
    return res.rowCount ?? 0;
  }

  async completeJob(
    job: ClaimedJob,
    workerId: string,
    result: unknown,
    startedAtMs: number,
  ): Promise<void> {
    await this.withTx(async (client) => {
      await client.query(
        `UPDATE jobs
            SET status = 'completed',
                completed_at = now(),
                lease_expires_at = NULL,
                result = $2::jsonb,
                updated_at = now()
          WHERE id = $1`,
        [job.id, JSON.stringify(result ?? null)],
      );
      await this.insertAttempt(client, job, workerId, 'succeeded', null, startedAtMs);
    });
  }

  /**
   * Record a failure and decide the job's fate: retry with backoff while
   * attempts remain, otherwise dead-letter. Returns the resulting status.
   */
  async failJob(
    job: ClaimedJob,
    workerId: string,
    error: string,
    startedAtMs: number,
  ): Promise<'ready' | 'dead'> {
    return this.withTx(async (client) => {
      const willRetry = job.attempts < job.maxAttempts;

      if (willRetry) {
        const {
          rows: [policy],
        } = await client.query<{
          backoff: BackoffStrategyValue;
          base_delay_ms: number;
          max_delay_ms: number;
          jitter: boolean;
        }>(
          `SELECT rp.backoff, rp.base_delay_ms, rp.max_delay_ms, rp.jitter
             FROM jobs j
             JOIN queues q ON q.id = j.queue_id
             JOIN retry_policies rp ON rp.id = q.retry_policy_id
            WHERE j.id = $1`,
          [job.id],
        );
        const delayMs = computeBackoffMs(
          {
            backoff: policy.backoff,
            baseDelayMs: policy.base_delay_ms,
            maxDelayMs: policy.max_delay_ms,
            jitter: policy.jitter,
          },
          job.attempts,
        );
        await client.query(
          `UPDATE jobs
              SET status = 'ready',
                  available_at = now() + ($2::bigint * interval '1 millisecond'),
                  last_error = $3,
                  lease_expires_at = NULL,
                  claimed_by = NULL,
                  updated_at = now()
            WHERE id = $1`,
          [job.id, delayMs, error],
        );
      } else {
        await client.query(
          `UPDATE jobs
              SET status = 'dead',
                  last_error = $2,
                  lease_expires_at = NULL,
                  updated_at = now()
            WHERE id = $1`,
          [job.id, error],
        );
      }

      await this.insertAttempt(client, job, workerId, 'failed', error, startedAtMs);
      return willRetry ? 'ready' : 'dead';
    });
  }

  private async insertAttempt(
    client: PoolClient,
    job: ClaimedJob,
    workerId: string,
    status: 'succeeded' | 'failed',
    error: string | null,
    startedAtMs: number,
  ): Promise<void> {
    await client.query(
      `INSERT INTO job_attempts
         (job_id, attempt_number, worker_id, status, error, started_at, finished_at, duration_ms)
       VALUES ($1, $2, $3, $4, $5, to_timestamp($6 / 1000.0), now(), $7)`,
      [
        job.id,
        job.attempts,
        workerId,
        status,
        error,
        startedAtMs,
        Date.now() - startedAtMs,
      ],
    );
  }

  private async withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
