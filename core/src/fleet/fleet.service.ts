import { Inject, Injectable } from '@nestjs/common';
import { gt, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

export interface WorkerDto {
  id: string;
  hostname: string;
  pid: number;
  status: string;
  queues: string[];
  concurrency: number;
  inFlight: number;
  version: string;
  startedAt: string;
  lastHeartbeatAt: string;
}

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class FleetService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** Workers seen in the last two minutes — the live fleet, not stale rows. */
  async list(): Promise<WorkerDto[]> {
    const rows = await this.db
      .select()
      .from(schema.workers)
      .where(gt(schema.workers.lastHeartbeatAt, sql`now() - interval '2 minutes'`))
      .orderBy(schema.workers.startedAt);

    return rows.map((w) => ({
      id: w.id,
      hostname: w.hostname,
      pid: w.pid,
      status: w.status,
      queues: w.queues,
      concurrency: w.concurrency,
      inFlight: w.inFlight,
      version: w.version,
      startedAt: w.startedAt.toISOString(),
      lastHeartbeatAt: w.lastHeartbeatAt.toISOString(),
    }));
  }
}
