import { Test, TestingModule } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../src/database/database.constants';
import * as schema from '../src/database/schema';
import { runMigrations } from '../src/database/migrate';
import { ClaimService } from '../src/worker/claim.service';
import { ConfigModule } from '../src/config/config.module';
import { DatabaseModule } from '../src/database/database.module';
import { WorkerModule } from '../src/worker/worker.module';

type Db = NodePgDatabase<typeof schema>;

/**
 * The reliability heart: exactly-once claiming and per-queue concurrency limits
 * under concurrent claimers. Requires Docker; runs in CI via `npm run test:int`.
 */
describe('ClaimService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let claims: ClaimService;
  let db: Db;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = container.getConnectionUri();
    process.env.JWT_ACCESS_SECRET = 'test-access-secret-min-16-chars';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-min-16-chars';
    process.env.NODE_ENV = 'test';

    await runMigrations(process.env.DATABASE_URL);

    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, WorkerModule],
    }).compile();
    claims = moduleRef.get(ClaimService);
    db = moduleRef.get<Db>(DRIZZLE);
  });

  afterAll(async () => {
    await moduleRef?.close();
    await container?.stop();
  });

  /** Create an org/project/queue and `count` ready jobs; returns queue + org id. */
  async function seedQueue(
    concurrencyLimit: number,
    count: number,
  ): Promise<{ queueId: string; orgId: string }> {
    const [org] = await db
      .insert(schema.orgs)
      .values({ name: 'O', slug: `o-${Math.random().toString(36).slice(2)}` })
      .returning();
    const [project] = await db
      .insert(schema.projects)
      .values({ orgId: org.id, name: 'P', slug: 'p' })
      .returning();
    const [policy] = await db
      .insert(schema.retryPolicies)
      .values({ projectId: project.id, name: 'rp' })
      .returning();
    const [queue] = await db
      .insert(schema.queues)
      .values({
        projectId: project.id,
        name: 'q',
        concurrencyLimit,
        retryPolicyId: policy.id,
      })
      .returning();

    await db.insert(schema.jobs).values(
      Array.from({ length: count }, () => ({
        orgId: org.id,
        projectId: project.id,
        queueId: queue.id,
        type: 'email' as const,
        status: 'ready' as const,
      })),
    );
    return { queueId: queue.id, orgId: org.id };
  }

  async function runningCount(queueId: string): Promise<number> {
    const rows = await db
      .select()
      .from(schema.jobs)
      .where(
        and(
          eq(schema.jobs.queueId, queueId),
          eq(schema.jobs.status, 'running'),
        ),
      );
    return rows.length;
  }

  it('never hands the same job to two workers (exactly-once)', async () => {
    const { queueId, orgId } = await seedQueue(1000, 60);

    // Eight workers claim aggressively at the same time.
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        claims.claim(`worker-${i}`, orgId, 60, 30_000),
      ),
    );

    const claimedIds = results.flat().map((j) => j.id);
    const unique = new Set(claimedIds);

    expect(claimedIds.length).toBe(60); // every job claimed
    expect(unique.size).toBe(60); // and none claimed twice
    expect(await runningCount(queueId)).toBe(60);
  });

  it('never exceeds a queue concurrency limit', async () => {
    const { queueId, orgId } = await seedQueue(3, 20);

    await Promise.all(
      Array.from({ length: 6 }, (_, i) =>
        claims.claim(`worker-${i}`, orgId, 20, 30_000),
      ),
    );

    // At most `concurrency_limit` may be running.
    expect(await runningCount(queueId)).toBe(3);
  });

  it('sets a future lease and increments attempts on claim', async () => {
    const { queueId, orgId } = await seedQueue(10, 1);
    const [claimed] = await claims.claim('worker-x', orgId, 1, 30_000);

    const [job] = await db
      .select()
      .from(schema.jobs)
      .where(eq(schema.jobs.id, claimed.id));

    expect(job.status).toBe('running');
    expect(job.claimedBy).toBe('worker-x');
    expect(job.attempts).toBe(1);
    expect(job.leaseExpiresAt!.getTime()).toBeGreaterThan(Date.now());
    expect(await runningCount(queueId)).toBe(1);
  });
});
