import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AdvisoriesController } from './advisories.controller';
import { AdvisoriesService } from './advisories.service';

@Module({
  imports: [AuthModule],
  controllers: [AdvisoriesController],
  providers: [AdvisoriesService],
})
export class AdvisoriesModule {}
