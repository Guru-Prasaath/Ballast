/**
 * Drizzle schema — the source of truth for the database structure and the input
 * to migration generation (`npm run db:generate`).
 *
 * Phase 1 introduces identity and configuration: orgs, users, projects, retry
 * policies, and queues. Job/attempt/worker tables land in Phases 2–3.
 */
import {
  boolean,
  integer,
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

// Convenience row types inferred from the schema.
export type Org = typeof orgs.$inferSelect;
export type User = typeof users.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type RetryPolicy = typeof retryPolicies.$inferSelect;
export type Queue = typeof queues.$inferSelect;
