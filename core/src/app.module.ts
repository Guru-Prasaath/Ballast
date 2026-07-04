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
  ],
})
export class AppModule {}
