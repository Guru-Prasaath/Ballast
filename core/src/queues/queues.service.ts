import { Inject, Injectable } from '@nestjs/common';
import { count, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

export interface QueueStats {
  ready: number;
  running: number;
  completed: number;
  failed: number;
  dead: number;
  scheduled: number;
}

export interface QueueDto {
  id: string;
  projectId: string;
  name: string;
  concurrencyLimit: number;
  paused: boolean;
  retryPolicyId: string;
  createdAt: string;
  stats: QueueStats;
}

export interface RetryPolicyDto {
  id: string;
  projectId: string;
  name: string;
  maxAttempts: number;
  backoff: string;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: boolean;
}

type Db = NodePgDatabase<typeof schema>;

const emptyStats = (): QueueStats => ({
  ready: 0,
  running: 0,
  completed: 0,
  failed: 0,
  dead: 0,
  scheduled: 0,
});

@Injectable()
export class QueuesService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** All queues in the org, each with a live per-status job breakdown. */
  async list(orgId: string): Promise<QueueDto[]> {
    const rows = await this.db
      .select({
        id: schema.queues.id,
        projectId: schema.queues.projectId,
        name: schema.queues.name,
        concurrencyLimit: schema.queues.concurrencyLimit,
        paused: schema.queues.paused,
        retryPolicyId: schema.queues.retryPolicyId,
        createdAt: schema.queues.createdAt,
      })
      .from(schema.queues)
      .innerJoin(
        schema.projects,
        eq(schema.queues.projectId, schema.projects.id),
      )
      .where(eq(schema.projects.orgId, orgId));

    const statsByQueue = await this.statsByQueue(orgId);

    return rows.map((q) => ({
      ...q,
      createdAt: q.createdAt.toISOString(),
      stats: statsByQueue.get(q.id) ?? emptyStats(),
    }));
  }

  /** All retry policies in the org. */
  async listRetryPolicies(orgId: string): Promise<RetryPolicyDto[]> {
    const rows = await this.db
      .select({
        id: schema.retryPolicies.id,
        projectId: schema.retryPolicies.projectId,
        name: schema.retryPolicies.name,
        maxAttempts: schema.retryPolicies.maxAttempts,
        backoff: schema.retryPolicies.backoff,
        baseDelayMs: schema.retryPolicies.baseDelayMs,
        maxDelayMs: schema.retryPolicies.maxDelayMs,
        jitter: schema.retryPolicies.jitter,
      })
      .from(schema.retryPolicies)
      .innerJoin(
        schema.projects,
        eq(schema.retryPolicies.projectId, schema.projects.id),
      )
      .where(eq(schema.projects.orgId, orgId));
    return rows;
  }

  private async statsByQueue(
    orgId: string,
  ): Promise<Map<string, QueueStats>> {
    const grouped = await this.db
      .select({
        queueId: schema.jobs.queueId,
        status: schema.jobs.status,
        value: count(),
      })
      .from(schema.jobs)
      .where(eq(schema.jobs.orgId, orgId))
      .groupBy(schema.jobs.queueId, schema.jobs.status);

    const map = new Map<string, QueueStats>();
    for (const row of grouped) {
      const stats = map.get(row.queueId) ?? emptyStats();
      stats[row.status] = row.value;
      map.set(row.queueId, stats);
    }
    return map;
  }
}
