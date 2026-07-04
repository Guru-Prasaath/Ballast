/**
 * MSW request handlers — the mock implementation of the Ballast API contract.
 *
 * These stand in for the core (NestJS) API during frontend development. Every
 * response matches a type from `@/types/api`. Latency is simulated so loading
 * states are exercised.
 */
import { HttpResponse, delay, http } from 'msw'
import type {
  AuthSession,
  CreateJobRequest,
  Job,
  JobFilter,
  JobStatus,
  JobType,
  Paginated,
} from '@/types/api'
import { db, filterJobs, overview } from './db'
import { constants } from './seed'

const BASE = '/api/v1'

function tokens(): AuthSession['tokens'] {
  return {
    accessToken: 'mock.access.token',
    refreshToken: 'mock.refresh.token',
    expiresAt: new Date(constants.NOW + 15 * 60_000).toISOString(),
  }
}

function session(): AuthSession {
  return { user: db.user, org: db.org, tokens: tokens() }
}

export const handlers = [
  // ── Auth ──────────────────────────────────────────────────────────────────
  http.post(`${BASE}/auth/login`, async () => {
    await delay(400)
    return HttpResponse.json(session())
  }),

  http.post(`${BASE}/auth/signup`, async () => {
    await delay(500)
    return HttpResponse.json(session())
  }),

  http.post(`${BASE}/auth/refresh`, async () => {
    await delay(150)
    return HttpResponse.json(tokens())
  }),

  http.get(`${BASE}/me`, async () => {
    await delay(120)
    return HttpResponse.json({ user: db.user, org: db.org })
  }),

  // ── Overview ────────────────────────────────────────────────────────────
  http.get(`${BASE}/overview`, async () => {
    await delay(250)
    return HttpResponse.json(overview())
  }),

  // ── Projects, queues, retry policies ────────────────────────────────────────
  http.get(`${BASE}/projects`, async () => {
    await delay(120)
    return HttpResponse.json(db.projects)
  }),

  http.get(`${BASE}/queues`, async () => {
    await delay(160)
    return HttpResponse.json(db.queues)
  }),

  http.get(`${BASE}/queues/:id`, async ({ params }) => {
    await delay(120)
    const queue = db.queues.find((q) => q.id === params.id)
    if (!queue) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(queue)
  }),

  http.get(`${BASE}/retry-policies`, async () => {
    await delay(120)
    return HttpResponse.json(db.retryPolicies)
  }),

  // ── Jobs ────────────────────────────────────────────────────────────────────
  http.get(`${BASE}/jobs`, async ({ request }) => {
    await delay(220)
    const url = new URL(request.url)
    const filter: JobFilter = {
      status: (url.searchParams.get('status') as JobStatus) ?? undefined,
      type: (url.searchParams.get('type') as JobType) ?? undefined,
      queueId: url.searchParams.get('queueId') ?? undefined,
      search: url.searchParams.get('search') ?? undefined,
      page: Number(url.searchParams.get('page') ?? 1),
      pageSize: Number(url.searchParams.get('pageSize') ?? 25),
    }
    const { data, total } = filterJobs(filter)
    const body: Paginated<Job> = {
      data,
      total,
      page: filter.page ?? 1,
      pageSize: filter.pageSize ?? 25,
    }
    return HttpResponse.json(body)
  }),

  http.get(`${BASE}/jobs/:id`, async ({ params }) => {
    await delay(140)
    const job = db.jobs.find((j) => j.id === params.id)
    if (!job) return new HttpResponse(null, { status: 404 })
    return HttpResponse.json(job)
  }),

  http.get(`${BASE}/jobs/:id/attempts`, async ({ params }) => {
    await delay(160)
    const rows = db.attempts.filter((a) => a.jobId === params.id)
    return HttpResponse.json(rows)
  }),

  http.post(`${BASE}/jobs`, async ({ request }) => {
    await delay(300)
    const input = (await request.json()) as CreateJobRequest
    const queue = db.queues.find((q) => q.id === input.queueId)
    if (!queue) return new HttpResponse(null, { status: 400 })

    const now = new Date().toISOString()
    const job: Job = {
      id: `job_${Math.random().toString(36).slice(2, 8)}`,
      queueId: input.queueId,
      projectId: queue.projectId,
      type: input.type,
      status: input.scheduledFor || input.cron ? 'scheduled' : 'ready',
      payload: input.payload,
      priority: input.priority ?? 0,
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 5,
      scheduledFor: input.scheduledFor ?? null,
      cron: input.cron ?? null,
      leaseExpiresAt: null,
      claimedBy: null,
      lastError: null,
      result: null,
      createdAt: now,
      updatedAt: now,
      startedAt: null,
      completedAt: null,
    }
    db.jobs.unshift(job)
    return HttpResponse.json(job, { status: 201 })
  }),

  http.post(`${BASE}/jobs/:id/retry`, async ({ params }) => {
    await delay(200)
    const job = db.jobs.find((j) => j.id === params.id)
    if (!job) return new HttpResponse(null, { status: 404 })
    job.status = 'ready'
    job.lastError = null
    job.updatedAt = new Date().toISOString()
    return HttpResponse.json(job)
  }),

  // ── Workers (fleet) ─────────────────────────────────────────────────────────
  http.get(`${BASE}/workers`, async () => {
    await delay(160)
    return HttpResponse.json(db.workers)
  }),

  // ── AI advisories ─────────────────────────────────────────────────────────
  http.get(`${BASE}/advisories`, async () => {
    await delay(180)
    return HttpResponse.json(db.advisories)
  }),

  http.post(`${BASE}/advisories/:id/ack`, async ({ params }) => {
    await delay(120)
    const advisory = db.advisories.find((a) => a.id === params.id)
    if (!advisory) return new HttpResponse(null, { status: 404 })
    advisory.acknowledged = true
    return HttpResponse.json(advisory)
  }),
]
