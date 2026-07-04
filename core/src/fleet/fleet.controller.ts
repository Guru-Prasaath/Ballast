import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { FleetService, WorkerDto } from './fleet.service';

@Controller('workers')
@UseGuards(JwtAuthGuard)
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<WorkerDto[]> {
    return this.fleet.list(user.orgId);
  }
}
