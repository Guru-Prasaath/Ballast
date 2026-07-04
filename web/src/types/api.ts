/**
 * Ballast API contract — the single source of truth for the shapes exchanged
 * between the web dashboard and the core (NestJS) API.
 *
 * The frontend is built against this contract with a mock (MSW) layer standing
 * in for the backend. When the core API lands, it must serialize these exact
 * shapes; nothing in the UI should need to change.
 *
 * Conventions:
 *  - All timestamps are ISO-8601 strings (UTC), e.g. "2026-07-04T14:00:00.000Z".
 *  - All ids are opaque strings (UUIDs in the real backend).
 *  - Durations are milliseconds unless a field name says otherwise.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

export type ISODateString = string
export type ID = string

export interface Paginated<T> {
  data: T[]
  page: number
  pageSize: number
  total: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Identity & tenancy
// ─────────────────────────────────────────────────────────────────────────────

export type UserRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Org {
  id: ID
  name: string
  slug: string
  createdAt: ISODateString
}

export interface User {
  id: ID
  orgId: ID
  email: string
  name: string
  role: UserRole
  createdAt: ISODateString
}

export interface Project {
  id: ID
  orgId: ID
  name: string
  slug: string
  createdAt: ISODateString
}

// ─────────────────────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  /** Access-token expiry, ISO-8601. */
  expiresAt: ISODateString
}

export interface LoginRequest {
  email: string
  password: string
}

export interface SignupRequest {
  orgName: string
  name: string
  email: string
  password: string
}

export interface AuthSession {
  user: User
  org: Org
  tokens: AuthTokens
}

// ─────────────────────────────────────────────────────────────────────────────
// Retry policies & queues
// ─────────────────────────────────────────────────────────────────────────────

export type BackoffStrategy = 'fixed' | 'linear' | 'exponential'

export interface RetryPolicy {
  id: ID
  projectId: ID
  name: string
  maxAttempts: number
  backoff: BackoffStrategy
  /** Base delay before the first retry, ms. */
  baseDelayMs: number
  /** Upper bound on any single backoff delay, ms. */
  maxDelayMs: number
  /** Whether random jitter is applied to backoff delays. */
  jitter: boolean
}

export interface QueueStats {
  ready: number
  running: number
  completed: number
  failed: number
  dead: number
  scheduled: number
}

export interface Queue {
  id: ID
  projectId: ID
  name: string
  /** Max jobs from this queue that may run concurrently across the fleet. */
  concurrencyLimit: number
  paused: boolean
  retryPolicyId: ID
  createdAt: ISODateString
  stats: QueueStats
}

// ─────────────────────────────────────────────────────────────────────────────
// Jobs
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The five task kinds Ballast ships handlers for. The `payload` shape depends
 * on the type; see `JobPayloadByType` for the per-type contract.
 */
export type JobType =
  | 'http_request'
  | 'email'
  | 'data_export'
  | 'image_transform'
  | 'report'

/**
 * Job lifecycle states.
 *
 *   scheduled → ready → running → completed
 *                        ↘ failed → (retry) ready
 *                                 ↘ dead   (dead-letter, attempts exhausted)
 */
export type JobStatus =
  | 'scheduled'
  | 'ready'
  | 'running'
  | 'completed'
  | 'failed'
  | 'dead'

export interface JobPayloadByType {
  http_request: { method: string; url: string; body?: unknown }
  email: { to: string; subject: string; template: string }
  data_export: { dataset: string; format: 'csv' | 'json' | 'parquet' }
  image_transform: { sourceUrl: string; width: number; height: number }
  report: { reportKind: string; rangeStart: string; rangeEnd: string }
}

export interface Job {
  id: ID
  queueId: ID
  projectId: ID
  type: JobType
  status: JobStatus
  payload: Record<string, unknown>
  /** Higher runs first within a queue. */
  priority: number
  attempts: number
  maxAttempts: number
  /** When a delayed/cron job becomes eligible to run. Null for immediate jobs. */
  scheduledFor: ISODateString | null
  /** Cron expression for recurring jobs; null for one-shot jobs. */
  cron: string | null
  /** Set while running; the reaper reclaims jobs past this instant. */
  leaseExpiresAt: ISODateString | null
  /** Worker id currently holding the claim, if running. */
  claimedBy: ID | null
  /** Last error message from the most recent failed attempt. */
  lastError: string | null
  result: unknown | null
  createdAt: ISODateString
  updatedAt: ISODateString
  startedAt: ISODateString | null
  completedAt: ISODateString | null
}

export interface JobAttempt {
  id: ID
  jobId: ID
  attemptNumber: number
  workerId: ID | null
  status: 'succeeded' | 'failed'
  error: string | null
  startedAt: ISODateString
  finishedAt: ISODateString
  durationMs: number
}

export interface CreateJobRequest {
  queueId: ID
  type: JobType
  payload: Record<string, unknown>
  priority?: number
  /** Delay before eligibility. Mutually exclusive with `cron`. */
  scheduledFor?: ISODateString
  cron?: string
  maxAttempts?: number
}

export interface JobFilter {
  status?: JobStatus
  type?: JobType
  queueId?: ID
  search?: string
  page?: number
  pageSize?: number
}

// ─────────────────────────────────────────────────────────────────────────────
// Workers (fleet)
// ─────────────────────────────────────────────────────────────────────────────

export type WorkerStatus = 'active' | 'idle' | 'draining' | 'offline'

export interface Worker {
  id: ID
  hostname: string
  pid: number
  status: WorkerStatus
  /** Queues this worker pulls from. */
  queues: string[]
  concurrency: number
  inFlight: number
  version: string
  startedAt: ISODateString
  lastHeartbeatAt: ISODateString
}

// ─────────────────────────────────────────────────────────────────────────────
// Metrics & overview
// ─────────────────────────────────────────────────────────────────────────────

export interface TimeseriesPoint {
  t: ISODateString
  value: number
}

export interface ThroughputPoint {
  t: ISODateString
  completed: number
  failed: number
}

export interface OverviewStats {
  jobsByStatus: Record<JobStatus, number>
  /** Jobs completed in the trailing 24h. */
  completed24h: number
  /** Jobs dead-lettered in the trailing 24h. */
  deadLettered24h: number
  /** Fraction 0..1 of attempts that succeeded in the trailing 24h. */
  successRate24h: number
  activeWorkers: number
  throughput: ThroughputPoint[]
  queueDepth: TimeseriesPoint[]
}

// ─────────────────────────────────────────────────────────────────────────────
// AI advisory (Phase 6 surface — UI renders these; the Python service produces them)
// ─────────────────────────────────────────────────────────────────────────────

export type AdvisorySeverity = 'info' | 'warning' | 'critical'

export type AdvisoryKind =
  | 'retry_tuning'
  | 'flaky_detection'
  | 'anomaly'
  | 'capacity'

export interface Advisory {
  id: ID
  kind: AdvisoryKind
  severity: AdvisorySeverity
  title: string
  summary: string
  recommendation: string
  /** Model confidence, 0..1. */
  confidence: number
  /** Optional entities the advisory references. */
  jobId: ID | null
  queueId: ID | null
  createdAt: ISODateString
  acknowledged: boolean
}

// ─────────────────────────────────────────────────────────────────────────────
// WebSocket event schema (live updates)
// ─────────────────────────────────────────────────────────────────────────────

interface WsEnvelope<K extends string, P> {
  type: K
  /** Server emit time, ISO-8601. */
  at: ISODateString
  payload: P
}

export type WsEvent =
  | WsEnvelope<'job.created', Job>
  | WsEnvelope<'job.updated', Job>
  | WsEnvelope<'worker.heartbeat', Worker>
  | WsEnvelope<'worker.offline', { workerId: ID }>
  | WsEnvelope<'queue.updated', Queue>
  | WsEnvelope<'metrics.tick', ThroughputPoint>
  | WsEnvelope<'advisory.created', Advisory>

export type WsEventType = WsEvent['type']
