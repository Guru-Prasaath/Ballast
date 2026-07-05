import { Module } from '@nestjs/common';
import { ConfigModule } from './config/config.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './auth/auth.module';
import { JobsModule } from './jobs/jobs.module';
import { QueuesModule } from './queues/queues.module';
import { SchedulerModule } from './scheduler/scheduler.module';
import { ReaperModule } from './reaper/reaper.module';
import { FleetModule } from './fleet/fleet.module';
import { OverviewModule } from './overview/overview.module';
import { AdvisoriesModule } from './advisories/advisories.module';
import { WorkerModule } from './worker/worker.module';
import { ProjectsModule } from './projects/projects.module';
import { LiveModule } from './live/live.module';

// For single-host deploys (e.g. a free-tier dyno): setting RUN_WORKER=true makes
// the API process also run a worker, so one service covers API + scheduler +
// reaper + worker. Requires WORKER_ORG_ID. Leave it off to scale workers as
// separate processes (see src/worker.ts) — exactly-once holds either way because
// claiming always goes through ClaimService's SKIP LOCKED path.
const runWorkerInProcess = process.env.RUN_WORKER === 'true';

@Module({
  imports: [
    ConfigModule,
    DatabaseModule,
    HealthModule,
    AuthModule,
    JobsModule,
    QueuesModule,
    SchedulerModule,
    ReaperModule,
    FleetModule,
    OverviewModule,
    AdvisoriesModule,
    LiveModule,
    ...(runWorkerInProcess ? [WorkerModule] : []),
    ProjectsModule,
  ],
})
export class AppModule {}
