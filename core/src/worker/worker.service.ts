import { hostname } from 'node:os';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.schema';
import { ClaimService, type ClaimedJob } from './claim.service';
import { WorkerRegistry } from './worker-registry';
import { runJob } from './handlers';

const WORKER_VERSION = '0.5.0';
const DRAIN_TIMEOUT_MS = 30_000;

/**
 * A worker process: registers itself, polls for claimable jobs, runs them, and
 * reports heartbeats. On SIGTERM it stops claiming, drains in-flight jobs, marks
 * itself offline, and exits (invariant #4). Multiple of these run as a fleet;
 * exactly-once holds because claiming goes through ClaimService's SKIP LOCKED path.
 */
@Injectable()
export class WorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private workerId?: string;
  private draining = false;
  private polling = false;
  private readonly inFlight = new Set<Promise<void>>();

  private pollTimer?: ReturnType<typeof setInterval>;
  private heartbeatTimer?: ReturnType<typeof setInterval>;

  private readonly concurrency: number;
  private readonly leaseMs: number;
  private readonly pollMs: number;
  private readonly heartbeatMs: number;
  private readonly queues: string[];
  private readonly orgId?: string;

  constructor(
    @Inject(ClaimService) private readonly claims: ClaimService,
    @Inject(WorkerRegistry) private readonly registry: WorkerRegistry,
    @Inject(ConfigService) config: ConfigService<Env, true>,
  ) {
    this.concurrency = config.get('WORKER_CONCURRENCY', { infer: true });
    this.leaseMs = config.get('LEASE_DURATION_MS', { infer: true });
    this.pollMs = config.get('WORKER_POLL_INTERVAL_MS', { infer: true });
    this.heartbeatMs = config.get('HEARTBEAT_INTERVAL_MS', { infer: true });
    this.orgId = config.get('WORKER_ORG_ID', { infer: true });
    this.queues = config
      .get('WORKER_QUEUES', { infer: true })
      .split(',')
      .map((q) => q.trim())
      .filter(Boolean);
  }

  async onApplicationBootstrap(): Promise<void> {
    if (!this.orgId) {
      throw new Error(
        'WORKER_ORG_ID is required — set it to the org this worker serves ' +
          '(find yours via GET /api/v1/me).',
      );
    }

    this.workerId = await this.registry.register({
      orgId: this.orgId,
      hostname: hostname(),
      pid: process.pid,
      queues: this.queues,
      concurrency: this.concurrency,
      version: WORKER_VERSION,
    });
    this.logger.log(
      `Worker ${this.workerId} online (concurrency ${this.concurrency})`,
    );

    this.pollTimer = setInterval(() => void this.poll(), this.pollMs);
    this.heartbeatTimer = setInterval(
      () => void this.heartbeat(),
      this.heartbeatMs,
    );
  }

  /** One claim tick. Guarded so overlapping timers never over-claim. */
  private async poll(): Promise<void> {
    if (this.draining || this.polling || !this.workerId || !this.orgId) return;
    this.polling = true;
    try {
      const capacity = this.concurrency - this.inFlight.size;
      if (capacity <= 0) return;

      const jobs = await this.claims.claim(
        this.workerId,
        this.orgId,
        capacity,
        this.leaseMs,
      );
      for (const job of jobs) this.process(job);
    } catch (err) {
      this.logger.error(`Claim failed: ${(err as Error).message}`);
    } finally {
      this.polling = false;
    }
  }

  private process(job: ClaimedJob): void {
    const startedAt = Date.now();
    const task = (async () => {
      try {
        const result = await runJob(
          job.type as Parameters<typeof runJob>[0],
          job.payload,
        );
        await this.claims.completeJob(job, this.workerId!, result, startedAt);
      } catch (err) {
        await this.claims.failJob(
          job,
          this.workerId!,
          (err as Error).message,
          startedAt,
        );
      }
    })();

    const tracked = task.finally(() => this.inFlight.delete(tracked));
    this.inFlight.add(tracked);
  }

  private async heartbeat(): Promise<void> {
    if (!this.workerId) return;
    try {
      await this.claims.extendLeases(this.workerId, this.leaseMs);
      await this.registry.heartbeat(
        this.workerId,
        this.inFlight.size,
        this.draining ? 'draining' : this.inFlight.size > 0 ? 'active' : 'idle',
      );
    } catch (err) {
      this.logger.warn(`Heartbeat failed: ${(err as Error).message}`);
    }
  }

  /** Graceful shutdown: stop claiming, let in-flight jobs finish, go offline. */
  async onModuleDestroy(): Promise<void> {
    this.draining = true;
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (!this.workerId) return;

    this.logger.log(
      `Draining ${this.inFlight.size} in-flight job(s) before exit`,
    );
    await this.drain();

    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    await this.registry.setStatus(this.workerId, 'offline');
    this.logger.log('Worker offline');
  }

  private async drain(): Promise<void> {
    const timeout = new Promise<void>((resolve) =>
      setTimeout(resolve, DRAIN_TIMEOUT_MS),
    );
    await Promise.race([
      Promise.allSettled(Array.from(this.inFlight)),
      timeout,
    ]);
    if (this.inFlight.size > 0) {
      this.logger.warn(
        `Drain timed out with ${this.inFlight.size} job(s) still running; their leases will expire and be reaped`,
      );
    }
  }
}
