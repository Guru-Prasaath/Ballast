import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { AppModule } from '../src/app.module';
import { runMigrations } from '../src/database/migrate';
import { HealthService } from '../src/health/health.service';

/**
 * Exercises the real database path against a throwaway Postgres. Requires
 * Docker; runs in CI via `npm run test:int`.
 */
describe('Health (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();

    // The migration pipeline must run cleanly (no-op in Phase 0).
    await runMigrations(process.env.DATABASE_URL);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  it('reports the database as up', async () => {
    const result = await app.get(HealthService).check();
    expect(result.status).toBe('ok');
    expect(result.db).toBe('up');
  });
});
