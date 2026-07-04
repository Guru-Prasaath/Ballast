import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import { PG_POOL } from '../database/database.constants';
import { HealthService } from './health.service';

function mockPool(behavior: 'up' | 'down'): Pool {
  if (behavior === 'down') {
    return {
      connect: jest.fn().mockRejectedValue(new Error('connection refused')),
    } as unknown as Pool;
  }
  const client = {
    query: jest.fn().mockResolvedValue({ rows: [{ '?column?': 1 }] }),
    release: jest.fn(),
  };
  return {
    connect: jest.fn().mockResolvedValue(client),
  } as unknown as Pool;
}

async function buildService(pool: Pool): Promise<HealthService> {
  const moduleRef = await Test.createTestingModule({
    providers: [HealthService, { provide: PG_POOL, useValue: pool }],
  }).compile();
  return moduleRef.get(HealthService);
}

describe('HealthService', () => {
  it('reports ok/up when the database responds', async () => {
    const service = await buildService(mockPool('up'));
    const result = await service.check();

    expect(result.status).toBe('ok');
    expect(result.db).toBe('up');
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('reports error/down when the database is unreachable', async () => {
    const service = await buildService(mockPool('down'));
    const result = await service.check();

    expect(result.status).toBe('error');
    expect(result.db).toBe('down');
  });

  it('releases the connection back to the pool after a successful check', async () => {
    const pool = mockPool('up');
    const service = await buildService(pool);
    await service.check();

    const client = await (pool.connect as jest.Mock).mock.results[0].value;
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
