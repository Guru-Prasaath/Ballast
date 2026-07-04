import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AccessTokenPayload } from './auth.types';
import type { AuthedRequest } from './jwt-auth.guard';

/** Injects the authenticated user's claims (set by JwtAuthGuard) into a handler. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccessTokenPayload => {
    return ctx.switchToHttp().getRequest<AuthedRequest>().user;
  },
);
