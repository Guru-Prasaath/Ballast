import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { and, eq, isNotNull, isNull, lte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { Env } from '../config/env.schema';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { nextCronRun } from '../jobs/cron.util';

type Db = NodePgDatabase<typeof schema>;

export interface PromotionResult {
  /** One-shot scheduled jobs moved to `ready`. */
  promoted: number;
  /** Ready instances spawned from due cron jobs. */
  spawned: number;
}

/**
 * The promoter. On a short interval it moves due one-shot scheduled jobs into
 * `ready`, and for each due cron job it spawns a runnable instance and advances
 * the cron row to its next occurrence. It never runs jobs — that's the worker's
 * job (Phase 3); this only makes them eligible.
 */
@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer?: ReturnType<typeof setInterval>;

  constructor(
    @Inject(DRIZZLE) private readonly db: Db,
    private readonly config: ConfigService<Env, true>,
  ) {}

  onModuleInit(): void {
    // Tests drive promoteDue() directly; don't run a background loop there.
    if (this.config.get('NODE_ENV', { infer: true }) === 'test') return;

    const interval = this.config.get('SCHEDULER_INTERVAL_MS', { infer: true });
    this.timer = setInterval(() => {
      this.promoteDue().catch((err) =>
        this.logger.error(`Promotion tick failed: ${(err as Error).message}`),
      );
    }, interval);
    this.logger.log(`Promoter started (every ${interval}ms)`);
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async promoteDue(now: Date = new Date()): Promise<PromotionResult> {
    const promoted = await this.promoteOneShot(now);
    const spawned = await this.spawnCronRuns(now);
    return { promoted, spawned };
  }

  private async promoteOneShot(now: Date): Promise<number> {
    const rows = await this.db
      .update(schema.jobs)
      .set({ status: 'ready', updatedAt: now })
      .where(
        and(
          eq(schema.jobs.status, 'scheduled'),
          isNull(schema.jobs.cron),
          lte(schema.jobs.availableAt, now),
        ),
      )
      .returning({ id: schema.jobs.id });
    return rows.length;
  }

  private async spawnCronRuns(now: Date): Promise<number> {
    const due = await this.db
      .select()
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.status, 'scheduled'),
          isNotNull(schema.jobs.cron),
          lte(schema.jobs.availableAt, now),
        ),
      );

    let spawned = 0;
    for (const job of due) {
      const next = nextCronRun(job.cron!, now);

      // Advance the cron row first; the conditional WHERE is the lock, so if
      // another instance already advanced it this claims nothing and we skip.
      const [claimed] = await this.db
        .update(schema.jobs)
        .set({ scheduledFor: next, availableAt: next, updatedAt: now })
        .where(
          and(
            eq(schema.jobs.id, job.id),
            eq(schema.jobs.status, 'scheduled'),
            lte(schema.jobs.availableAt, now),
          ),
        )
        .returning({ id: schema.jobs.id });
      if (!claimed) continue;

      await this.db.insert(schema.jobs).values({
        orgId: job.orgId,
        projectId: job.projectId,
        queueId: job.queueId,
        type: job.type,
        status: 'ready',
        payload: job.payload,
        priority: job.priority,
        maxAttempts: job.maxAttempts,
        availableAt: now,
      });
      spawned += 1;
    }
    return spawned;
  }
}
