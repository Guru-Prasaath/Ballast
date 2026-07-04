import {
  Global,
  Inject,
  Module,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { Env } from '../config/env.schema';
import { DRIZZLE, PG_POOL } from './database.constants';
import * as schema from './schema';

/**
 * Owns the single pg connection pool for the process and the Drizzle instance
 * built on top of it. The pool is small on purpose — Supabase's free tier caps
 * backend connections, and the core runs many worker processes.
 */
@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) => {
        return new Pool({
          connectionString: config.get('DATABASE_URL', { infer: true }),
          max: 10,
          application_name: 'ballast-core',
        });
      },
    },
    {
      provide: DRIZZLE,
      inject: [PG_POOL],
      useFactory: (pool: Pool) => drizzle(pool, { schema }),
    },
  ],
  exports: [PG_POOL, DRIZZLE],
})
export class DatabaseModule implements OnModuleDestroy {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  /** Drain the pool on shutdown so the process can exit cleanly. */
  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    this.logger.log('Database pool closed');
  }
}
