import { Test, TestingModule } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../src/database/database.constants';
import * as schema from '../src/database/schema';
import { runMigrations } from '../src/database/migrate';
import { ClaimService, type ClaimedJob } from '../src/worker/claim.service';
import { ReaperService } from '../src/reaper/reaper.service';
import { ConfigModule } from '../src/config/config.module';
import { DatabaseModule } from '../src/database/database.module';
import { WorkerModule } from '../src/worker/worker.module';
import { ReaperModule } from '../src/reaper/reaper.module';

type Db = NodePgDatabase<typeof schema>;

/**
 * Reliability: retry-with-backoff, dead-lettering, and lease reaping.
 * Requires Docker; runs in CI via `npm run test:int`.
 */
describe('Reliability (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let claims: ClaimService;
  let reaper: ReaperService;
  let db: Db;
  let queueId: string;
  let orgId: string;
  let projectId: string;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-16-chars';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-16-chars';
    process.env.NODE_ENV = 'test';
    await runMigrations(process.env.DATABASE_URL);

    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, WorkerModule, ReaperModule],
    }).compile();
    claims = moduleRef.get(ClaimService);
    reaper = moduleRef.get(ReaperService);
    db = moduleRef.get<Db>(DRIZZLE);

    const [org] = await db
      .insert(schema.orgs)
      .values({ name: 'O', slug: `o-${Math.random().toString(36).slice(2)}` })
      .returning();
    orgId = org.id;
    const [project] = await db
      .insert(schema.projects)
      .values({ orgId, name: 'P', slug: 'p' })
      .returning();
    projectId = project.id;
    const [policy] = await db
      .insert(schema.retryPolicies)
      .values({ projectId, name: 'rp', backoff: 'exponential', baseDelayMs: 1000 })
      .returning();
    const [queue] = await db
      .insert(schema.queues)
      .values({ projectId, name: 'q', retryPolicyId: policy.id })
      .returning();
    queueId = queue.id;
  });

  afterAll(async () => {
    await moduleRef?.close();
    await container?.stop();
  });

  async function insertRunning(
    attempts: number,
    maxAttempts: number,
    leaseExpiresAt: Date,
  ): Promise<ClaimedJob> {
    const [job] = await db
      .insert(schema.jobs)
      .values({
        orgId,
        projectId,
        queueId,
        type: 'email',
        status: 'running',
        attempts,
        maxAttempts,
        claimedBy: 'worker-x',
        leaseExpiresAt,
        startedAt: new Date(),
      })
      .returning();
    return {
      id: job.id,
      queueId,
      type: 'email',
      payload: {},
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
    };
  }

  const statusOf = async (id: string) =>
    (await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)))[0];

  it('retries a failed job with a future backoff while attempts remain', async () => {
    const job = await insertRunning(1, 3, new Date(Date.now() + 30_000));
    const outcome = await claims.failJob(job, 'worker-x', 'boom', Date.now());

    expect(outcome).toBe('ready');
    const row = await statusOf(job.id);
    expect(row.status).toBe('ready');
    expect(row.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(row.lastError).toBe('boom');
    expect(row.claimedBy).toBeNull();
  });

  it('dead-letters a job once attempts are exhausted', async () => {
    const job = await insertRunning(3, 3, new Date(Date.now() + 30_000));
    const outcome = await claims.failJob(job, 'worker-x', 'final', Date.now());

    expect(outcome).toBe('dead');
    expect((await statusOf(job.id)).status).toBe('dead');
  });

  it('records a failed attempt row on failure', async () => {
    const job = await insertRunning(1, 3, new Date(Date.now() + 30_000));
    await claims.failJob(job, 'worker-x', 'oops', Date.now());

    const attempts = await db
      .select()
      .from(schema.jobAttempts)
      .where(eq(schema.jobAttempts.jobId, job.id));
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('failed');
    expect(attempts[0].error).toBe('oops');
  });

  it('reaper requeues an expired-lease job with attempts remaining', async () => {
    const job = await insertRunning(1, 5, new Date(Date.now() - 1000));
    const result = await reaper.reapExpired();

    expect(result.requeued).toBeGreaterThanOrEqual(1);
    const row = await statusOf(job.id);
    expect(row.status).toBe('ready');
    expect(row.claimedBy).toBeNull();
    expect(row.leaseExpiresAt).toBeNull();
  });

  it('reaper dead-letters an expired-lease job with no attempts left', async () => {
    const job = await insertRunning(5, 5, new Date(Date.now() - 1000));
    await reaper.reapExpired();
    expect((await statusOf(job.id)).status).toBe('dead');
  });
});
