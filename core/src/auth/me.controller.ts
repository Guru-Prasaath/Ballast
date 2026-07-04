import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CurrentUser } from './current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AccessTokenPayload, OrgDto, UserDto } from './auth.types';

@Controller('me')
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly auth: AuthService) {}

  /** The authenticated user and their org. */
  @Get()
  me(
    @CurrentUser() user: AccessTokenPayload,
  ): Promise<{ user: UserDto; org: OrgDto }> {
    return this.auth.me(user.sub);
  }
}
