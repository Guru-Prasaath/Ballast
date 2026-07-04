import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { QueuesService, RetryPolicyDto } from './queues.service';

@Controller('retry-policies')
@UseGuards(JwtAuthGuard)
export class RetryPoliciesController {
  constructor(private readonly queues: QueuesService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<RetryPolicyDto[]> {
    return this.queues.listRetryPolicies(user.orgId);
  }
}
