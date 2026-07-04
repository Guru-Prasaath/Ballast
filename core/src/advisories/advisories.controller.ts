import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AccessTokenPayload } from '../auth/auth.types';
import { AdvisoriesService, AdvisoryDto } from './advisories.service';

@Controller('advisories')
@UseGuards(JwtAuthGuard)
export class AdvisoriesController {
  constructor(private readonly advisories: AdvisoriesService) {}

  @Get()
  list(@CurrentUser() user: AccessTokenPayload): Promise<AdvisoryDto[]> {
    return this.advisories.list(user.orgId);
  }

  @Post(':id/ack')
  @HttpCode(200)
  ack(
    @CurrentUser() user: AccessTokenPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<AdvisoryDto> {
    return this.advisories.acknowledge(user.orgId, id);
  }
}
