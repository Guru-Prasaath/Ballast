import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool } from 'pg';
import type { Env } from '../config/env.schema';
import { PG_POOL } from '../database/database.constants';

export interface ReapResult {
  /** Expired-lease jobs returned to `ready` for re-claiming. */
  requeued: number;
  /** Expired-lease jobs that had exhausted their attempts, dead-lettered. */
  deadLettered: number;
}

/**
 * The reaper — crash recovery (invariant #3). A worker that dies mid-job leaves
 * its jobs `running` with a lease that stops being renewed. On a short interval
 * this returns those expired-lease jobs to `ready` (or dead-letters them if
 * their attempts are exhausted), so another worker can pick them up. Combined
 * with SKIP LOCKED claiming, this is what makes exactly-once survive crashes.
 */
@Injectable()
export class ReaperService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReaperService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(PG_POOL) private readonly pool: Pool,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;
    const interval = this.config.get('REAPER_INTERVAL_MS', { infer: true });
    this.timer = setInterval(() => {
      this.reapExpired().catch((err) =>
        this.logger.error(`Reap tick failed: ${(err as Error).message}`),
      );
    }, interval);
    this.logger.log(`Reaper started (every ${interval}ms)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  /** Reclaim every running job whose lease has expired. */
  async reapExpired(): Promise<ReapResult> {
    const { rows } = await this.pool.query<{ status: string }>(
      `UPDATE jobs
          SET status = CASE WHEN attempts >= max_attempts THEN 'dead'::job_status ELSE 'ready'::job_status END,
              available_at = now(),
              lease_expires_at = NULL,
              claimed_by = NULL,
              last_error = COALESCE(last_error, 'Lease expired — worker crash or timeout'),
              updated_at = now()
        WHERE status = 'running' AND lease_expires_at < now()
        RETURNING status`,
    );

    const deadLettered = rows.filter((r) => r.status === 'dead').length;
    const requeued = rows.length - deadLettered;
    if (rows.length > 0) {
      this.logger.warn(
        `Reaped ${rows.length} expired lease(s): ${requeued} requeued, ${deadLettered} dead-lettered`,
      );
    }
    return { requeued, deadLettered };
  }
}
