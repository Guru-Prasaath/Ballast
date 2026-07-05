import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { Env } from '../config/env.schema';
import type {
  AccessTokenPayload,
  AuthTokens,
  RefreshTokenPayload,
} from './auth.types';

/**
 * Signs and verifies access/refresh JWTs. Access and refresh tokens use
 * separate secrets so one cannot be replayed as the other.
 */
@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  async issueTokens(payload: AccessTokenPayload): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
      expiresIn: this.config.get('JWT_ACCESS_TTL', { infer: true }),
    });
    const refreshToken = await this.jwt.signAsync(
      { sub: payload.sub } satisfies RefreshTokenPayload,
      {
        secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
        expiresIn: this.config.get('JWT_REFRESH_TTL', { infer: true }),
      },
    );

    const decoded = this.jwt.decode<{ exp: number }>(accessToken);
    const expiresAt = new Date(decoded.exp * 1000).toISOString();

    return { accessToken, refreshToken, expiresAt };
  }

  verifyAccess(token: string): Promise<AccessTokenPayload> {
    return this.jwt.verifyAsync<AccessTokenPayload>(token, {
      secret: this.config.get('JWT_ACCESS_SECRET', { infer: true }),
    });
  }

  verifyRefresh(token: string): Promise<RefreshTokenPayload> {
    return this.jwt.verifyAsync<RefreshTokenPayload>(token, {
      secret: this.config.get('JWT_REFRESH_SECRET', { infer: true }),
    });
  }
}
