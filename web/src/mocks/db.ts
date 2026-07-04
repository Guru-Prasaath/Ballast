/**
 * In-memory mock database. Holds the seed data as mutable arrays and exposes
 * small query helpers the MSW handlers use. This is the swap-out point: when
 * the real API arrives, handlers are deleted and nothing else changes.
 */
import type {
  Job,
  JobFilter,
  OverviewStats,
  JobStatus,
  ThroughputPoint,
  TimeseriesPoint,
} from '@/types/api'
import {
  advisories,
  attempts,
  constants,
  jobs,
  org,
  projects,
  queues,
  retryPolicies,
  user,
  workers,
} from './seed'

const { NOW, HOUR, iso } = constants

export const db = {
  org,
  user,
  projects,
  retryPolicies,
  queues,
  jobs,
  attempts,
  workers,
  advisories,
}

const EMPTY_STATUS_COUNTS: Record<JobStatus, number> = {
  scheduled: 0,
  ready: 0,
  running: 0,
  completed: 0,
  failed: 0,
  dead: 0,
}

export function filterJobs(filter: JobFilter): { data: Job[]; total: number } {
  let rows = db.jobs
  if (filter.status) rows = rows.filter((j) => j.status === filter.status)
  if (filter.type) rows = rows.filter((j) => j.type === filter.type)
  if (filter.queueId) rows = rows.filter((j) => j.queueId === filter.queueId)
  if (filter.search) {
    const q = filter.search.toLowerCase()
    rows = rows.filter(
      (j) =>
        j.id.toLowerCase().includes(q) ||
        j.type.toLowerCase().includes(q) ||
        JSON.stringify(j.payload).toLowerCase().includes(q),
    )
  }
  rows = [...rows].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))

  const total = rows.length
  const page = filter.page ?? 1
  const pageSize = filter.pageSize ?? 25
  const start = (page - 1) * pageSize
  return { data: rows.slice(start, start + pageSize), total }
}

function jobsByStatus(): Record<JobStatus, number> {
  const counts = { ...EMPTY_STATUS_COUNTS }
  for (const job of db.jobs) counts[job.status] += 1
  return counts
}

/** Synthesize a 24h hourly throughput series from completed/failed jobs. */
function throughputSeries(): ThroughputPoint[] {
  const points: ThroughputPoint[] = []
  for (let h = 23; h >= 0; h--) {
    const bucketStart = NOW - h * HOUR
    const bucketEnd = bucketStart + HOUR
    let completed = 0
    let failed = 0
    for (const job of db.jobs) {
      const done = job.completedAt ? Date.parse(job.completedAt) : null
      if (done !== null && done >= bucketStart && done < bucketEnd) completed++
      if (
        (job.status === 'failed' || job.status === 'dead') &&
        Date.parse(job.updatedAt) >= bucketStart &&
        Date.parse(job.updatedAt) < bucketEnd
      ) {
        failed++
      }
    }
    points.push({ t: iso(NOW - bucketStart), completed, failed })
  }
  return points
}

function queueDepthSeries(): TimeseriesPoint[] {
  const backlog = db.jobs.filter(
    (j) => j.status === 'ready' || j.status === 'scheduled',
  ).length
  return Array.from({ length: 24 }, (_, i) => ({
    t: iso((23 - i) * HOUR),
    // Slight synthetic wave around the current backlog for a lively chart.
    value: Math.max(0, Math.round(backlog * (0.6 + 0.4 * Math.sin(i / 3)))),
  }))
}

export function overview(): OverviewStats {
  const byStatus = jobsByStatus()
  const throughput = throughputSeries()
  const completed24h = throughput.reduce((s, p) => s + p.completed, 0)
  const failed24h = throughput.reduce((s, p) => s + p.failed, 0)
  const attemptsTotal = completed24h + failed24h
  return {
    jobsByStatus: byStatus,
    completed24h,
    deadLettered24h: byStatus.dead,
    successRate24h: attemptsTotal ? completed24h / attemptsTotal : 1,
    activeWorkers: db.workers.filter((w) => w.status === 'active').length,
    throughput,
    queueDepth: queueDepthSeries(),
  }
}
