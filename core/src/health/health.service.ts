import { Inject, Injectable, Logger } from '@nestjs/common';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';

export interface HealthResult {
  status: 'ok' | 'error';
  db: 'up' | 'down';
  latencyMs: number;
  uptimeSeconds: number;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Ping the database with a trivial query; report status and round-trip time. */
  async check(): Promise<HealthResult> {
    const startedAt = Date.now();
    let db: HealthResult['db'] = 'down';

    try {
      const client = await this.pool.connect();
      try {
        await client.query('SELECT 1');
        db = 'up';
      } finally {
        client.release();
      }
    } catch (err) {
      this.logger.warn(
        `Database health check failed: ${(err as Error).message}`,
      );
    }

    return {
      status: db === 'up' ? 'ok' : 'error',
      db,
      latencyMs: Date.now() - startedAt,
      uptimeSeconds: Math.floor(process.uptime()),
    };
  }
}
