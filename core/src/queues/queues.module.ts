import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueuesController } from './queues.controller';
import { RetryPoliciesController } from './retry-policies.controller';
import { QueuesService } from './queues.service';

@Module({
  imports: [AuthModule],
  controllers: [QueuesController, RetryPoliciesController],
  providers: [QueuesService],
})
export class QueuesModule {}
