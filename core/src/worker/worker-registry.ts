import { Inject, Injectable } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

type Db = NodePgDatabase<typeof schema>;
type WorkerStatusValue = (typeof schema.workerStatus.enumValues)[number];

export interface WorkerRegistration {
  hostname: string;
  pid: number;
  queues: string[];
  concurrency: number;
  version: string;
}

/** Manages the worker's own row in the `workers` table (registration + heartbeat). */
@Injectable()
export class WorkerRegistry {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  async register(info: WorkerRegistration): Promise<string> {
    const [row] = await this.db
      .insert(schema.workers)
      .values({
        hostname: info.hostname,
        pid: info.pid,
        queues: info.queues,
        concurrency: info.concurrency,
        version: info.version,
        status: 'active',
      })
      .returning({ id: schema.workers.id });
    return row.id;
  }

  async heartbeat(
    id: string,
    inFlight: number,
    status: WorkerStatusValue,
  ): Promise<void> {
    await this.db
      .update(schema.workers)
      .set({ inFlight, status, lastHeartbeatAt: new Date() })
      .where(eq(schema.workers.id, id));
  }

  async setStatus(id: string, status: WorkerStatusValue): Promise<void> {
    await this.db
      .update(schema.workers)
      .set({ status, lastHeartbeatAt: new Date() })
      .where(eq(schema.workers.id, id));
  }
}
