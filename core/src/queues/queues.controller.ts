import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { QueueDto, QueuesService } from './queues.service';

@Controller('queues')
@UseGuards(JwtAuthGuard)
export class QueuesController {
  constructor(private readonly queues: QueuesService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<QueueDto[]> {
    return this.queues.list(user.orgId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
  ): Promise<QueueDto> {
    return this.queues.getById(user.orgId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id') id: string,
    @Body() body: { paused?: boolean; concurrencyLimit?: number },
  ): Promise<QueueDto> {
    return this.queues.update(user.orgId, id, body);
  }
}
