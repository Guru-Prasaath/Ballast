import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, count, desc, eq, ilike, or, sql, type SQL } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { CreateJobDto } from './dto/create-job.dto';
import { ListJobsQuery } from './dto/list-jobs.query';
import { isValidCron, nextCronRun } from './cron.util';
import { assertTransition, InvalidJobTransitionError } from './job-state-machine';
import {
  JobAttemptDto,
  JobDto,
  Paginated,
  toAttemptDto,
  toJobDto,
} from './job.types';

type Db = NodePgDatabase<typeof schema>;

@Injectable()
export class JobsService {
  constructor(@Inject(DRIZZLE) private readonly db: Db) {}

  /** Submit a job. Sets its initial state from the scheduling options. */
  async create(orgId: string, dto: CreateJobDto): Promise<JobDto> {
    if (dto.scheduledFor && dto.cron) {
      throw new BadRequestException(
        'Provide either scheduledFor or cron, not both',
      );
    }
    if (dto.cron && !isValidCron(dto.cron)) {
      throw new BadRequestException('Invalid cron expression');
    }

    const queue = await this.resolveQueue(orgId, dto.queueId);
    const now = new Date();

    let status: schema.JobStatusValue = 'ready';
    let availableAt = now;
    let scheduledFor: Date | null = null;

    if (dto.cron) {
      scheduledFor = nextCronRun(dto.cron, now);
      availableAt = scheduledFor;
      status = 'scheduled';
    } else if (dto.scheduledFor) {
      const when = new Date(dto.scheduledFor);
      if (when.getTime() > now.getTime()) {
        scheduledFor = when;
        availableAt = when;
        status = 'scheduled';
      }
    }

    const [job] = await this.db
      .insert(schema.jobs)
      .values({
        orgId,
        projectId: queue.projectId,
        queueId: queue.id,
        type: dto.type,
        status,
        payload: dto.payload ?? {},
        priority: dto.priority ?? 0,
        maxAttempts: dto.maxAttempts ?? queue.maxAttempts,
        availableAt,
        scheduledFor,
        cron: dto.cron ?? null,
      })
      .returning();

    return toJobDto(job);
  }

  async list(orgId: string, query: ListJobsQuery): Promise<Paginated<JobDto>> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;

    const conditions: SQL[] = [eq(schema.jobs.orgId, orgId)];
    if (query.status) conditions.push(eq(schema.jobs.status, query.status));
    if (query.type) conditions.push(eq(schema.jobs.type, query.type));
    if (query.queueId) conditions.push(eq(schema.jobs.queueId, query.queueId));
    if (query.search) {
      const like = `%${query.search}%`;
      conditions.push(
        or(
          ilike(sql`${schema.jobs.id}::text`, like),
          ilike(sql`${schema.jobs.payload}::text`, like),
        )!,
      );
    }
    const where = and(...conditions);

    const [{ value: total }] = await this.db
      .select({ value: count() })
      .from(schema.jobs)
      .where(where);

    const data = await this.db
      .select()
      .from(schema.jobs)
      .where(where)
      .orderBy(desc(schema.jobs.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { data: data.map(toJobDto), page, pageSize, total };
  }

  async get(orgId: string, id: string): Promise<JobDto> {
    return toJobDto(await this.getJob(orgId, id));
  }

  async getAttempts(orgId: string, id: string): Promise<JobAttemptDto[]> {
    await this.getJob(orgId, id); // ensures the job is in this org
    const rows = await this.db
      .select()
      .from(schema.jobAttempts)
      .where(eq(schema.jobAttempts.jobId, id))
      .orderBy(schema.jobAttempts.attemptNumber);
    return rows.map(toAttemptDto);
  }

  /** Replay a failed or dead-lettered job by returning it to `ready`. */
  async retry(orgId: string, id: string): Promise<JobDto> {
    const job = await this.getJob(orgId, id);
    try {
      assertTransition(job.status, 'ready');
    } catch (err) {
      if (err instanceof InvalidJobTransitionError) {
        throw new BadRequestException(
          `Cannot retry a job in status "${job.status}"`,
        );
      }
      throw err;
    }

    const [updated] = await this.db
      .update(schema.jobs)
      .set({
        status: 'ready',
        availableAt: new Date(),
        leaseExpiresAt: null,
        claimedBy: null,
        lastError: null,
        updatedAt: new Date(),
      })
      .where(eq(schema.jobs.id, id))
      .returning();

    return toJobDto(updated);
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async getJob(orgId: string, id: string): Promise<schema.Job> {
    const [job] = await this.db
      .select()
      .from(schema.jobs)
      .where(and(eq(schema.jobs.id, id), eq(schema.jobs.orgId, orgId)))
      .limit(1);
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  /** Look up a queue and confirm it belongs to the caller's org. */
  private async resolveQueue(
    orgId: string,
    queueId: string,
  ): Promise<{ id: string; projectId: string; maxAttempts: number }> {
    const [row] = await this.db
      .select({
        id: schema.queues.id,
        projectId: schema.queues.projectId,
        orgId: schema.projects.orgId,
        maxAttempts: schema.retryPolicies.maxAttempts,
      })
      .from(schema.queues)
      .innerJoin(
        schema.projects,
        eq(schema.queues.projectId, schema.projects.id),
      )
      .innerJoin(
        schema.retryPolicies,
        eq(schema.queues.retryPolicyId, schema.retryPolicies.id),
      )
      .where(eq(schema.queues.id, queueId))
      .limit(1);

    if (!row || row.orgId !== orgId) {
      throw new BadRequestException('Unknown queue');
    }
    return { id: row.id, projectId: row.projectId, maxAttempts: row.maxAttempts };
  }
}
