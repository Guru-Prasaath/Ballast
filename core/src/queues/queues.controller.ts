import { Controller, Get, UseGuards } from '@nestjs/common';
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
}
