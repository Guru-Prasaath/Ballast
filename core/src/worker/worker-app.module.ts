import { Module } from '@nestjs/common';
import { ConfigModule } from '../config/config.module';
import { DatabaseModule } from '../database/database.module';
import { WorkerModule } from './worker.module';

/** Root module for a worker process: config + database + the worker loop only. */
@Module({
  imports: [ConfigModule, DatabaseModule, WorkerModule],
})
export class WorkerAppModule {}
