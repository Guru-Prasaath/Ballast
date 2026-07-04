/**
 * Drizzle schema — the source of truth for the database structure and the input
 * to migration generation (`npm run db:generate`).
 *
 * Phase 1 introduces identity and configuration: orgs, users, projects, retry
 * policies, and queues. Job/attempt/worker tables land in Phases 2–3.
 */
import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', [
  'owner',
  'admin',
  'member',
  'viewer',
]);

export const backoffStrategy = pgEnum('backoff_strategy', [
  'fixed',
  'linear',
  'exponential',
]);

export const orgs = pgTable('orgs', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  orgId: uuid('org_id')
    .notNull()
    .references(() => orgs.id, { onDelete: 'cascade' }),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  role: userRole('role').notNull().default('member'),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const projects = pgTable(
  'projects',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    orgSlugUnique: unique('projects_org_slug_unique').on(t.orgId, t.slug),
  }),
);

export const retryPolicies = pgTable('retry_policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  projectId: uuid('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  maxAttempts: integer('max_attempts').notNull().default(5),
  backoff: backoffStrategy('backoff').notNull().default('exponential'),
  baseDelayMs: integer('base_delay_ms').notNull().default(2000),
  maxDelayMs: integer('max_delay_ms').notNull().default(300000),
  jitter: boolean('jitter').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const queues = pgTable(
  'queues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    concurrencyLimit: integer('concurrency_limit').notNull().default(10),
    paused: boolean('paused').notNull().default(false),
    retryPolicyId: uuid('retry_policy_id')
      .notNull()
      .references(() => retryPolicies.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => ({
    projectNameUnique: unique('queues_project_name_unique').on(
      t.projectId,
      t.name,
    ),
  }),
);

export const jobType = pgEnum('job_type', [
  'http_request',
  'email',
  'data_export',
  'image_transform',
  'report',
]);

export const jobStatus = pgEnum('job_status', [
  'scheduled',
  'ready',
  'running',
  'completed',
  'failed',
  'dead',
]);

export const attemptStatus = pgEnum('attempt_status', ['succeeded', 'failed']);

export const workerStatus = pgEnum('worker_status', [
  'active',
  'idle',
  'draining',
  'offline',
]);

export const workers = pgTable('workers', {
  id: uuid('id').primaryKey().defaultRandom(),
  hostname: text('hostname').notNull(),
  pid: integer('pid').notNull(),
  status: workerStatus('status').notNull().default('active'),
  queues: text('queues').array().notNull(),
  concurrency: integer('concurrency').notNull(),
  inFlight: integer('in_flight').notNull().default(0),
  version: text('version').notNull(),
  startedAt: timestamp('started_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
  lastHeartbeatAt: timestamp('last_heartbeat_at', { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const jobs = pgTable(
  'jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // org_id and project_id are denormalized from the queue for cheap scoping
    // and to keep the hot claim query (Phase 3) off extra joins.
    orgId: uuid('org_id')
      .notNull()
      .references(() => orgs.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    queueId: uuid('queue_id')
      .notNull()
      .references(() => queues.id, { onDelete: 'cascade' }),
    type: jobType('type').notNull(),
    status: jobStatus('status').notNull().default('ready'),
    payload: jsonb('payload')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    priority: integer('priority').notNull().default(0),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(5),
    // When the job becomes eligible to run. Ready jobs use now(); delayed and
    // backed-off jobs use a future instant. The claim query filters on this.
    availableAt: timestamp('available_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }),
    cron: text('cron'),
    leaseExpiresAt: timestamp('lease_expires_at', { withTimezone: true }),
    claimedBy: text('claimed_by'),
    lastError: text('last_error'),
    result: jsonb('result').$type<unknown>(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => ({
    // Supports the promoter and the SKIP LOCKED claim query (Phase 3).
    dispatchIdx: index('jobs_dispatch_idx').on(
      t.status,
      t.availableAt,
      t.priority,
    ),
    queueIdx: index('jobs_queue_idx').on(t.queueId),
    orgIdx: index('jobs_org_idx').on(t.orgId),
  }),
);

export const jobAttempts = pgTable(
  'job_attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    jobId: uuid('job_id')
      .notNull()
      .references(() => jobs.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    workerId: text('worker_id'),
    status: attemptStatus('status').notNull(),
    error: text('error'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }).notNull(),
    durationMs: integer('duration_ms').notNull(),
  },
  (t) => ({
    jobIdx: index('job_attempts_job_idx').on(t.jobId),
  }),
);

// Convenience row types inferred from the schema.
export type Org = typeof orgs.$inferSelect;
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type RetryPolicy = typeof retryPolicies.$inferSelect;
export type Queue = typeof queues.$inferSelect;
export type Job = typeof jobs.$inferSelect;
export type JobAttempt = typeof jobAttempts.$inferSelect;
export type Worker = typeof workers.$inferSelect;
export type JobStatusValue = (typeof jobStatus.enumValues)[number];
export type JobTypeValue = (typeof jobType.enumValues)[number];
export type BackoffStrategyValue = (typeof backoffStrategy.enumValues)[number];
