import { Test, TestingModule } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { spawn } from 'child_process';
import { DRIZZLE } from '../src/database/database.constants';
import * as schema from '../src/database/schema';
import { runMigrations } from '../src/database/migrate';
import { ClaimService } from '../src/worker/claim.service';
import { ReaperService } from '../src/reaper/reaper.service';
import { ConfigModule } from '../src/config/config.module';
import { DatabaseModule } from '../src/database/database.module';
import { WorkerModule } from '../src/worker/worker.module';
import { ReaperModule } from '../src/reaper/reaper.module';

type Db = NodePgDatabase<typeof schema>;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Phase 7 - Chaos Test: The headline proof.
 * Spawns a real worker process, kills it mid-job with SIGKILL (kill -9),
 * and asserts that the lease expires, the reaper requeues it, and another worker
 * is able to successfully finish the job. Ensures exactly-once execution despite
 * hard crashes.
 */
describe('Chaos Recovery (integration)', () => {
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
      .values({ name: 'ChaosOrg', slug: `chaos-${Math.random().toString(36).slice(2)}` })
      .returning();
    orgId = org.id;

    const [project] = await db
      .insert(schema.projects)
      .values({ orgId, name: 'ChaosProject', slug: 'chaos-p' })
      .returning();
    projectId = project.id;

    const [policy] = await db
      .insert(schema.retryPolicies)
      .values({ projectId, name: 'rp' })
      .returning();

    const [queue] = await db
      .insert(schema.queues)
      .values({ projectId, name: 'chaos-q', retryPolicyId: policy.id })
      .returning();
    queueId = queue.id;
  });

  afterAll(async () => {
    await moduleRef?.close();
    await container?.stop();
  });

  it('recovers from a kill -9 worker crash mid-job and finishes exactly-once', async () => {
    // 1. Insert a job that will intentionally take 10 seconds (stallMs)
    const [job] = await db
      .insert(schema.jobs)
      .values({
        orgId,
        projectId,
        queueId,
        type: 'email',
        payload: { stallMs: 10000 },
        status: 'ready',
      })
      .returning();

    // 2. Spawn a worker process with a short lease duration (2 seconds)
    const workerProcess = spawn('npx', ['tsx', 'src/worker.ts'], {
      env: {
        ...process.env,
        WORKER_ORG_ID: orgId,
        WORKER_QUEUES: 'chaos-q',
        WORKER_CONCURRENCY: '1',
        WORKER_POLL_INTERVAL_MS: '200',
        LEASE_DURATION_MS: '2000',
        HEARTBEAT_INTERVAL_MS: '500',
      },
    });

    // 3. Wait for the job to be claimed and start running
    let isRunning = false;
    let workerId: string | null = null;
    for (let i = 0; i < 50; i++) {
      const [row] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
      if (row.status === 'running') {
        isRunning = true;
        workerId = row.claimedBy;
        break;
      }
      await sleep(100);
    }
    
    expect(isRunning).toBe(true);
    expect(workerId).not.toBeNull();

    // 4. Send a SIGKILL (kill -9) to the worker
    workerProcess.kill('SIGKILL');

    // 5. Wait for the lease to expire (2000ms + buffer)
    await sleep(2500);

    // Ensure it's still "running" in the DB before the reaper runs
    const [stuckJob] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
    expect(stuckJob.status).toBe('running');
    expect(stuckJob.leaseExpiresAt!.getTime()).toBeLessThanOrEqual(Date.now());

    // 6. Run the reaper
    const reapResult = await reaper.reapExpired();
    expect(reapResult.requeued).toBeGreaterThanOrEqual(1);

    const [requeuedJob] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
    expect(requeuedJob.status).toBe('ready');
    expect(requeuedJob.claimedBy).toBeNull();
    expect(requeuedJob.leaseExpiresAt).toBeNull();
    expect(requeuedJob.attempts).toBe(1); // the first crashed attempt

    // 7. Start another worker (simulated via ClaimService in test) to finish it
    const [claimed] = await claims.claim('worker-rescue', orgId, 1, 30_000);
    expect(claimed).toBeDefined();
    expect(claimed.id).toBe(job.id);

    // Complete it quickly
    await claims.completeJob(claimed, 'worker-rescue', { delivered: true }, Date.now());

    const [finishedJob] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, job.id));
    expect(finishedJob.status).toBe('completed');
    expect(finishedJob.attempts).toBe(2);
    expect(finishedJob.result).toEqual({ delivered: true });

    // Ensure the job recorded the lease expiry error
    expect(finishedJob.lastError).toContain('Lease expired');

    // The crashed attempt does not create a job_attempts row (no graceful failJob),
    // so there is only 1 attempt recorded (the successful one).
    const attempts = await db.select().from(schema.jobAttempts).where(eq(schema.jobAttempts.jobId, job.id)).orderBy(schema.jobAttempts.attemptNumber);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].status).toBe('succeeded');
    expect(attempts[0].attemptNumber).toBe(2); // but it was attempt #2
  }, 20000);
});
