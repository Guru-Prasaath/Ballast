import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { TokenService } from './token.service';

const CONFIG: Record<string, string> = {
  JWT_ACCESS_SECRET: 'access-secret-at-least-16-chars',
  JWT_REFRESH_SECRET: 'refresh-secret-at-least-16-chars',
  JWT_ACCESS_TTL: '15m',
  JWT_REFRESH_TTL: '7d',
};

async function buildService(): Promise<TokenService> {
  const moduleRef = await Test.createTestingModule({
    imports: [JwtModule.register({})],
    providers: [
      TokenService,
      { provide: ConfigService, useValue: { get: (k: string) => CONFIG[k] } },
    ],
  }).compile();
  return moduleRef.get(TokenService);
}

describe('TokenService', () => {
  it('issues an access/refresh pair with an ISO expiry', async () => {
    const service = await buildService();
    const tokens = await service.issueTokens({
      sub: 'user-1',
      orgId: 'org-1',
      role: 'owner',
    });

    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.refreshToken).toEqual(expect.any(String));
    expect(new Date(tokens.expiresAt).getTime()).toBeGreaterThan(Date.now());
  });

  it('round-trips the access token claims', async () => {
    const service = await buildService();
    const { accessToken } = await service.issueTokens({
      sub: 'user-1',
      orgId: 'org-1',
      role: 'admin',
    });

    const payload = await service.verifyAccess(accessToken);
    expect(payload.sub).toBe('user-1');
    expect(payload.orgId).toBe('org-1');
    expect(payload.role).toBe('admin');
  });

  it('does not accept an access token as a refresh token', async () => {
    const service = await buildService();
    const { accessToken } = await service.issueTokens({
      sub: 'user-1',
      orgId: 'org-1',
      role: 'owner',
    });

    // Different secret → verification must fail.
    await expect(service.verifyRefresh(accessToken)).rejects.toThrow();
  });
});
