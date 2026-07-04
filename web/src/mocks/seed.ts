/**
 * Deterministic seed data for the mock backend.
 *
 * A fixed-seed PRNG keeps fixtures stable across reloads (so the UI doesn't
 * jump around during development), while timestamps are anchored to "now" so
 * the dashboard always looks current.
 */
import type {
  Advisory,
  Job,
  JobAttempt,
  JobStatus,
  JobType,
  Org,
  Project,
  Queue,
  QueueStats,
  RetryPolicy,
  User,
  Worker,
} from '@/types/api'

// ── Seeded PRNG (mulberry32) ────────────────────────────────────────────────
function mulberry32(seed: number) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rand = mulberry32(0xba11a57)

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rand() * arr.length)]
const randInt = (min: number, max: number): number =>
  Math.floor(rand() * (max - min + 1)) + min

const NOW = Date.now()
const iso = (msAgo: number): string => new Date(NOW - msAgo).toISOString()
const isoAhead = (msAhead: number): string =>
  new Date(NOW + msAhead).toISOString()

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

// ── Identity & tenancy ──────────────────────────────────────────────────────
export const org: Org = {
  id: 'org_northwind',
  name: 'Northwind Labs',
  slug: 'northwind',
  createdAt: iso(120 * DAY),
}

export const user: User = {
  id: 'user_ada',
  orgId: org.id,
  email: 'ada@northwind.dev',
  name: 'Ada Okoye',
  role: 'owner',
  createdAt: iso(120 * DAY),
}

export const projects: Project[] = [
  {
    id: 'proj_billing',
    orgId: org.id,
    name: 'Billing',
    slug: 'billing',
    createdAt: iso(90 * DAY),
  },
  {
    id: 'proj_media',
    orgId: org.id,
    name: 'Media Pipeline',
    slug: 'media',
    createdAt: iso(60 * DAY),
  },
]

// ── Retry policies ──────────────────────────────────────────────────────────
export const retryPolicies: RetryPolicy[] = [
  {
    id: 'rp_standard',
    projectId: 'proj_billing',
    name: 'Standard exponential',
    maxAttempts: 5,
    backoff: 'exponential',
    baseDelayMs: 2_000,
    maxDelayMs: 5 * MINUTE,
    jitter: true,
  },
  {
    id: 'rp_aggressive',
    projectId: 'proj_media',
    name: 'Aggressive linear',
    maxAttempts: 8,
    backoff: 'linear',
    baseDelayMs: 1_000,
    maxDelayMs: MINUTE,
    jitter: false,
  },
  {
    id: 'rp_gentle',
    projectId: 'proj_billing',
    name: 'Gentle fixed',
    maxAttempts: 3,
    backoff: 'fixed',
    baseDelayMs: 10_000,
    maxDelayMs: 10_000,
    jitter: false,
  },
]

// ── Queues ──────────────────────────────────────────────────────────────────
const QUEUE_DEFS = [
  { id: 'q_default', projectId: 'proj_billing', name: 'default', concurrencyLimit: 25, retryPolicyId: 'rp_standard' },
  { id: 'q_emails', projectId: 'proj_billing', name: 'emails', concurrencyLimit: 10, retryPolicyId: 'rp_gentle' },
  { id: 'q_exports', projectId: 'proj_billing', name: 'exports', concurrencyLimit: 4, retryPolicyId: 'rp_standard' },
  { id: 'q_images', projectId: 'proj_media', name: 'images', concurrencyLimit: 16, retryPolicyId: 'rp_aggressive' },
] as const

// ── Jobs ────────────────────────────────────────────────────────────────────
const JOB_TYPES: JobType[] = [
  'http_request',
  'email',
  'data_export',
  'image_transform',
  'report',
]

const ERRORS = [
  'ECONNRESET: connection reset by peer',
  'Timeout after 30000ms',
  'HTTP 503 from upstream',
  'Validation failed: missing field "amount"',
  'Rate limited by provider (429)',
]

function payloadFor(type: JobType): Record<string, unknown> {
  switch (type) {
    case 'http_request':
      return { method: 'POST', url: 'https://api.northwind.dev/webhooks/billing' }
    case 'email':
      return { to: 'customer@example.com', subject: 'Your receipt', template: 'receipt' }
    case 'data_export':
      return { dataset: 'invoices_2026_q2', format: pick(['csv', 'json', 'parquet']) }
    case 'image_transform':
      return { sourceUrl: 's3://media/raw/asset.png', width: 1280, height: 720 }
    case 'report':
      return { reportKind: 'revenue', rangeStart: iso(30 * DAY), rangeEnd: iso(0) }
  }
}

// Distribution weighted toward a healthy-but-busy system.
const STATUS_WEIGHTS: [JobStatus, number][] = [
  ['completed', 62],
  ['running', 8],
  ['ready', 10],
  ['scheduled', 8],
  ['failed', 8],
  ['dead', 4],
]

function weightedStatus(): JobStatus {
  const total = STATUS_WEIGHTS.reduce((s, [, w]) => s + w, 0)
  let r = rand() * total
  for (const [status, w] of STATUS_WEIGHTS) {
    if ((r -= w) <= 0) return status
  }
  return 'completed'
}

function makeJob(i: number): Job {
  const queue = QUEUE_DEFS[i % QUEUE_DEFS.length]
  const type = pick(JOB_TYPES)
  const status = weightedStatus()
  const maxAttempts = randInt(3, 8)
  const createdMsAgo = randInt(1, 22 * HOUR)
  const isCron = status === 'scheduled' && rand() < 0.4

  const attempts =
    status === 'dead'
      ? maxAttempts
      : status === 'failed'
        ? randInt(1, maxAttempts - 1)
        : status === 'completed' || status === 'running'
          ? randInt(1, 2)
          : 0

  const startedAt =
    status === 'running' || status === 'completed'
      ? iso(createdMsAgo - randInt(1, 30) * 1000)
      : null

  return {
    id: `job_${(1000 + i).toString(36)}`,
    queueId: queue.id,
    projectId: queue.projectId,
    type,
    status,
    payload: payloadFor(type),
    priority: pick([0, 0, 0, 5, 10]),
    attempts,
    maxAttempts,
    scheduledFor: status === 'scheduled' ? isoAhead(randInt(1, 120) * MINUTE) : null,
    cron: isCron ? '*/15 * * * *' : null,
    leaseExpiresAt: status === 'running' ? isoAhead(randInt(10, 55) * 1000) : null,
    claimedBy: status === 'running' ? `worker_${randInt(1, 5)}` : null,
    lastError:
      status === 'failed' || status === 'dead' ? pick(ERRORS) : null,
    result: status === 'completed' ? { ok: true } : null,
    createdAt: iso(createdMsAgo),
    updatedAt: iso(randInt(0, createdMsAgo)),
    startedAt,
    completedAt: status === 'completed' ? iso(randInt(0, createdMsAgo)) : null,
  }
}

export const jobs: Job[] = Array.from({ length: 140 }, (_, i) => makeJob(i))

// ── Job attempts (history for a subset of jobs) ─────────────────────────────
export const attempts: JobAttempt[] = jobs.flatMap((job) => {
  const rows: JobAttempt[] = []
  for (let n = 1; n <= job.attempts; n++) {
    const failed = n < job.attempts || job.status === 'failed' || job.status === 'dead'
    const startedMsAgo = randInt(1, 20) * MINUTE
    rows.push({
      id: `att_${job.id}_${n}`,
      jobId: job.id,
      attemptNumber: n,
      workerId: `worker_${randInt(1, 5)}`,
      status: failed ? 'failed' : 'succeeded',
      error: failed ? pick(ERRORS) : null,
      startedAt: iso(startedMsAgo),
      finishedAt: iso(startedMsAgo - randInt(1, 20) * 1000),
      durationMs: randInt(120, 20_000),
    })
  }
  return rows
})

// ── Queue stats derived from jobs ───────────────────────────────────────────
function statsFor(queueId: string): QueueStats {
  const base: QueueStats = {
    ready: 0,
    running: 0,
    completed: 0,
    failed: 0,
    dead: 0,
    scheduled: 0,
  }
  for (const job of jobs) {
    if (job.queueId === queueId) base[job.status] += 1
  }
  return base
}

export const queues: Queue[] = QUEUE_DEFS.map((q) => ({
  id: q.id,
  projectId: q.projectId,
  name: q.name,
  concurrencyLimit: q.concurrencyLimit,
  paused: q.id === 'q_exports',
  retryPolicyId: q.retryPolicyId,
  createdAt: iso(60 * DAY),
  stats: statsFor(q.id),
}))

// ── Workers ─────────────────────────────────────────────────────────────────
export const workers: Worker[] = Array.from({ length: 5 }, (_, i) => {
  const n = i + 1
  const status: Worker['status'] =
    n === 5 ? 'draining' : n === 4 ? 'idle' : 'active'
  const concurrency = pick([8, 16, 25])
  return {
    id: `worker_${n}`,
    hostname: `ballast-worker-${n}.northwind.internal`,
    pid: randInt(1000, 9000),
    status,
    queues: pick([['default', 'emails'], ['images'], ['default', 'exports']]),
    concurrency,
    inFlight: status === 'idle' ? 0 : randInt(1, concurrency),
    version: '0.4.1',
    startedAt: iso(randInt(1, 6) * HOUR),
    lastHeartbeatAt: iso(randInt(1, 8) * 1000),
  }
})

// ── AI advisories ───────────────────────────────────────────────────────────
export const advisories: Advisory[] = [
  {
    id: 'adv_1',
    kind: 'retry_tuning',
    severity: 'warning',
    title: 'exports queue is retrying too aggressively',
    summary:
      'Jobs on the "exports" queue fail on attempt 1 then succeed on attempt 2 in 84% of cases, suggesting a cold-cache warmup rather than a real fault.',
    recommendation:
      'Raise baseDelayMs from 2s to 8s on the "Standard exponential" policy to cut wasted attempts by ~40%.',
    confidence: 0.82,
    jobId: null,
    queueId: 'q_exports',
    createdAt: iso(2 * HOUR),
    acknowledged: false,
  },
  {
    id: 'adv_2',
    kind: 'flaky_detection',
    severity: 'info',
    title: 'http_request jobs to billing webhook are flaky',
    summary:
      'ECONNRESET accounts for 61% of failures on http_request jobs, clustered around minute boundaries.',
    recommendation:
      'Add jitter to the retry policy and consider a circuit breaker on the billing webhook host.',
    confidence: 0.71,
    jobId: null,
    queueId: 'q_default',
    createdAt: iso(5 * HOUR),
    acknowledged: false,
  },
  {
    id: 'adv_3',
    kind: 'capacity',
    severity: 'critical',
    title: 'images queue is saturated',
    summary:
      'The "images" queue has sustained a ready backlog above its concurrency limit for 40 minutes; p95 wait time is 6.2 minutes.',
    recommendation:
      'Add 1–2 workers subscribed to "images" or raise its concurrency limit from 16 to 24.',
    confidence: 0.9,
    jobId: null,
    queueId: 'q_images',
    createdAt: iso(35 * MINUTE),
    acknowledged: false,
  },
]

export const constants = { NOW, MINUTE, HOUR, DAY, iso, isoAhead }
