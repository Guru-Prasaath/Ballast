import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { TokenService } from './token.service';
import type { AccessTokenPayload } from './auth.types';

/** Request augmented with the authenticated user's claims. */
export interface AuthedRequest extends Request {
  user: AccessTokenPayload;
}

/**
 * Guards routes behind a valid access token. Extracts the Bearer token, verifies
 * it, and attaches the claims to the request for @CurrentUser to read.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly tokens: TokenService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing bearer token');
    }

    const token = header.slice('Bearer '.length);
    try {
      request.user = await this.tokens.verifyAccess(token);
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
