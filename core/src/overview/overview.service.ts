import { Inject, Injectable } from '@nestjs/common';
import { and, count, eq, gt, gte, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

type JobStatus = schema.JobStatusValue;

export interface ThroughputPoint {
  t: string;
  completed: number;
  failed: number;
}

export interface OverviewStats {
  jobsByStatus: Record<JobStatus, number>;
  completed24h: number;
  deadLettered24h: number;
  successRate24h: number;
  activeWorkers: number;
  throughput: ThroughputPoint[];
  queueDepth: { t: string; value: number }[];
}

type Db = NodePgDatabase<typeof schema>;

const emptyStatusCounts = (): Record<JobStatus, number> => ({
  scheduled: 0,
  ready: 0,
  running: 0,
  completed: 0,
  failed: 0,
  dead: 0,
});

@Injectable()
export class OverviewService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async get(orgId: string): Promise<OverviewStats> {
    const [byStatus, activeWorkers, throughput, deadLettered24h] =
      await Promise.all([
        this.jobsByStatus(orgId),
        this.activeWorkers(),
        this.throughput(orgId),
        this.deadLettered24h(orgId),
      ]);

    const completed24h = throughput.reduce((s, p) => s + p.completed, 0);
    const failed24h = throughput.reduce((s, p) => s + p.failed, 0);
    const attempts = completed24h + failed24h;

    return {
      jobsByStatus: byStatus,
      completed24h,
      deadLettered24h,
      successRate24h: attempts ? completed24h / attempts : 1,
      activeWorkers,
      throughput,
      queueDepth: [],
    };
  }

  private async jobsByStatus(orgId: string): Promise<Record<JobStatus, number>> {
    const rows = await this.db
      .select({ status: schema.jobs.status, value: count() })
      .from(schema.jobs)
      .where(eq(schema.jobs.orgId, orgId))
      .groupBy(schema.jobs.status);

    const counts = emptyStatusCounts();
    for (const r of rows) counts[r.status] = r.value;
    return counts;
  }

  private async activeWorkers(): Promise<number> {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(schema.workers)
      .where(
        gt(schema.workers.lastHeartbeatAt, sql`now() - interval '2 minutes'`),
      );
    return value;
  }

  private async deadLettered24h(orgId: string): Promise<number> {
    const [{ value }] = await this.db
      .select({ value: count() })
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.orgId, orgId),
          eq(schema.jobs.status, 'dead'),
          gte(schema.jobs.updatedAt, sql`now() - interval '24 hours'`),
        ),
      );
    return value;
  }

  /** 24 hourly buckets of succeeded/failed attempts over the trailing day. */
  private async throughput(orgId: string): Promise<ThroughputPoint[]> {
    const result = await this.db.execute<{
      bucket: Date;
      completed: string;
      failed: string;
    }>(sql`
      SELECT date_trunc('hour', a.finished_at) AS bucket,
             count(*) FILTER (WHERE a.status = 'succeeded') AS completed,
             count(*) FILTER (WHERE a.status = 'failed') AS failed
        FROM job_attempts a
        JOIN jobs j ON j.id = a.job_id
       WHERE j.org_id = ${orgId}
         AND a.finished_at >= now() - interval '24 hours'
       GROUP BY bucket
    `);

    const byHour = new Map<number, { completed: number; failed: number }>();
    for (const row of result.rows) {
      byHour.set(new Date(row.bucket).setMinutes(0, 0, 0), {
        completed: Number(row.completed),
        failed: Number(row.failed),
      });
    }

    const hourMs = 3_600_000;
    const currentHour = new Date().setMinutes(0, 0, 0);
    return Array.from({ length: 24 }, (_, i) => {
      const t = currentHour - (23 - i) * hourMs;
      const bucket = byHour.get(t);
      return {
        t: new Date(t).toISOString(),
        completed: bucket?.completed ?? 0,
        failed: bucket?.failed ?? 0,
      };
    });
  }
}
