import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { runMigrations } from '../src/database/migrate';
import { SchedulerService } from '../src/scheduler/scheduler.service';

/**
 * Job submission, the state machine, and the promoter against a real Postgres.
 * Requires Docker (Testcontainers); runs in CI via `npm run test:int`.
 */
describe('Jobs (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let scheduler: SchedulerService;
  let token: string;
  let queueId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-16-chars';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-16-chars';
    process.env.NODE_ENV = 'test';

    await runMigrations(process.env.DATABASE_URL);

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    app.setGlobalPrefix('api/v1', { exclude: ['health'] });
    await app.init();
    scheduler = app.get(SchedulerService);

    const signup = await request(app.getHttpServer())
      .post('/api/v1/auth/signup')
      .send({
        orgName: 'Acme',
        name: 'Dev',
        email: 'dev@acme.test',
        password: 'password-123',
      });
    token = signup.body.tokens.accessToken;

    const queues = await request(app.getHttpServer())
      .get('/api/v1/queues')
      .set('Authorization', `Bearer ${token}`);
    queueId = queues.body[0].id;
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  const http = () => request(app.getHttpServer());
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('submits an immediate job as ready', async () => {
    const res = await http()
      .post('/api/v1/jobs')
      .set(auth())
      .send({ queueId, type: 'email', payload: { to: 'a@b.c' } });

    expect(res.status).toBe(201);
    expect(res.body.status).toBe('ready');
    expect(res.body.type).toBe('email');
  });

  it('rejects a job for an unknown queue with 400', async () => {
    const res = await http()
      .post('/api/v1/jobs')
      .set(auth())
      .send({ queueId: '00000000-0000-0000-0000-000000000000', type: 'email' });
    expect(res.status).toBe(400);
  });

  it('schedules a delayed job, then the promoter makes it ready', async () => {
    const when = new Date(Date.now() + 60_000).toISOString();
    const created = await http()
      .post('/api/v1/jobs')
      .set(auth())
      .send({ queueId, type: 'report', scheduledFor: when });
    expect(created.body.status).toBe('scheduled');

    // Promote as if the future arrived.
    const result = await scheduler.promoteDue(new Date(Date.now() + 120_000));
    expect(result.promoted).toBeGreaterThanOrEqual(1);

    const after = await http()
      .get(`/api/v1/jobs/${created.body.id}`)
      .set(auth());
    expect(after.body.status).toBe('ready');
  });

  it('spawns a run from a due cron job and keeps the cron scheduled', async () => {
    const created = await http()
      .post('/api/v1/jobs')
      .set(auth())
      .send({ queueId, type: 'data_export', cron: '*/5 * * * *' });
    expect(created.body.status).toBe('scheduled');
    expect(created.body.cron).toBe('*/5 * * * *');

    const before = await http()
      .get('/api/v1/jobs?type=data_export&pageSize=100')
      .set(auth());

    const result = await scheduler.promoteDue(new Date(Date.now() + 600_000));
    expect(result.spawned).toBeGreaterThanOrEqual(1);

    const after = await http()
      .get('/api/v1/jobs?type=data_export&pageSize=100')
      .set(auth());
    expect(after.body.total).toBe(before.body.total + result.spawned);

    // The cron template stays scheduled.
    const cronJob = await http()
      .get(`/api/v1/jobs/${created.body.id}`)
      .set(auth());
    expect(cronJob.body.status).toBe('scheduled');
  });

  it('refuses to retry a job that is not failed or dead', async () => {
    const created = await http()
      .post('/api/v1/jobs')
      .set(auth())
      .send({ queueId, type: 'email' });

    const res = await http()
      .post(`/api/v1/jobs/${created.body.id}/retry`)
      .set(auth());
    expect(res.status).toBe(400);
  });

  it('scopes jobs to the caller and 404s on unknown ids', async () => {
    const res = await http()
      .get('/api/v1/jobs/11111111-1111-1111-1111-111111111111')
      .set(auth());
    expect(res.status).toBe(404);
  });
});
