import { Controller, Get, Res } from '@nestjs/common';
import type { Response } from 'express';
import { HealthResult, HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Liveness + readiness in one probe. Returns 200 when the database is
   * reachable and 503 otherwise, so orchestrators can gate traffic on it.
   */
  @Get()
  async get(
    @Res({ passthrough: true }) res: Response,
  ): Promise<HealthResult> {
    const result = await this.health.check();
    res.status(result.status === 'ok' ? 200 : 503);
    return result;
  }
}
