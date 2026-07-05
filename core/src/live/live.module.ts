import { Module } from '@nestjs/common';
import { LiveController } from './live.controller';
import { FleetModule } from '../fleet/fleet.module';
import { AdvisoriesModule } from '../advisories/advisories.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [FleetModule, AdvisoriesModule, AuthModule],
  controllers: [LiveController],
})
export class LiveModule {}
