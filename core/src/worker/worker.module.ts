import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClaimService } from './claim.service';
import { WorkerRegistry } from './worker-registry';
import { WorkerService } from './worker.service';

/** Runs inside worker processes only (see src/worker.ts), not the API. */
@Module({
  imports: [ConfigModule],
  providers: [ClaimService, WorkerRegistry, WorkerService],
  exports: [ClaimService, WorkerRegistry],
})
export class WorkerModule {}
