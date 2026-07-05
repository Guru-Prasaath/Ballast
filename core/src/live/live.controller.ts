import { Controller, Sse, Query, UnauthorizedException } from '@nestjs/common';
import { Observable, interval } from 'rxjs';
import { mergeMap, filter } from 'rxjs/operators';
import { FleetService } from '../fleet/fleet.service';
import { TokenService } from '../auth/token.service';

@Controller('live')
export class LiveController {
  constructor(
    private readonly fleet: FleetService,
    private readonly tokens: TokenService,
  ) {}

  @Sse('feed')
  async feed(@Query('token') token: string): Promise<Observable<{ data: unknown }>> {
    if (!token) {
      throw new UnauthorizedException('Missing token query parameter for SSE');
    }

    let payload;
    try {
      payload = await this.tokens.verifyAccess(token);
    } catch {
      throw new UnauthorizedException('Invalid token for SSE');
    }

    const orgId = payload.orgId;

    return interval(3000).pipe(
      mergeMap(async () => {
        try {
          const workers = await this.fleet.list(orgId);
          if (workers.length === 0) return null;
          const worker = workers[Math.floor(Math.random() * workers.length)];
          return {
            data: {
              type: 'worker.heartbeat',
              at: worker.lastHeartbeatAt,
              payload: worker,
            }
          };
        } catch (e) {
          return null;
        }
      }),
      filter((val: any): val is { data: unknown } => val !== null),
    );
  }
}
