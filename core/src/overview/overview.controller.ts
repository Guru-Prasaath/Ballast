import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { OverviewService, OverviewStats } from './overview.service';

@Controller('overview')
@UseGuards(JwtAuthGuard)
export class OverviewController {
  constructor(private readonly overview: OverviewService) {}

  @Get()
  get(@CurrentUser() user: AccessTokenPayload): Promise<OverviewStats> {
    return this.overview.get(user.orgId);
  }
}
