import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { QueuesService, RetryPolicyDto } from './queues.service';
import type { BackoffStrategyValue } from '../database/schema';

@Controller('retry-policies')
@UseGuards(JwtAuthGuard)
export class RetryPoliciesController {
  constructor(private readonly queues: QueuesService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<RetryPolicyDto[]> {
    return this.queues.listRetryPolicies(user.orgId);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: {
      maxAttempts?: number;
      backoff?: BackoffStrategyValue;
      baseDelayMs?: number;
      maxDelayMs?: number;
      jitter?: boolean;
    },
  ): Promise<RetryPolicyDto> {
    return this.queues.updateRetryPolicy(user.orgId, id, body);
  }
}
