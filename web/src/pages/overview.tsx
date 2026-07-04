import { Link } from 'react-router-dom'
import { ArrowRight, CheckCircle2, Server, Skull, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { ThroughputChart } from '@/components/charts/throughput-chart'
import { StatusBadge } from '@/components/status-badge'
import { useAdvisories, useOverview } from '@/hooks/queries'
import type { JobStatus } from '@/types/api'
import { cn } from '@/lib/utils'

const STATUS_ORDER: JobStatus[] = [
  'running',
  'ready',
  'scheduled',
  'completed',
  'failed',
  'dead',
]

const STATUS_BAR: Record<JobStatus, string> = {
  scheduled: 'bg-state-scheduled',
  ready: 'bg-state-ready',
  running: 'bg-state-running',
  completed: 'bg-state-completed',
  failed: 'bg-state-failed',
  dead: 'bg-state-dead',
}

export function OverviewPage() {
  const { data, isLoading } = useOverview()
  const { data: advisories } = useAdvisories()

  const total = data
    ? Object.values(data.jobsByStatus).reduce((s, n) => s + n, 0)
    : 0
  const topAdvisories = (advisories ?? [])
    .filter((a) => !a.acknowledged)
    .slice(0, 2)

  return (
    <div>
      <PageHeader
        title="Overview"
        description="Live health of the Ballast job fleet across all queues."
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Completed (24h)"
          value={data?.completed24h ?? 0}
          icon={CheckCircle2}
          accent="text-state-completed"
          loading={isLoading}
        />
        <StatCard
          label="Success rate"
          value={
            data ? `${Math.round(data.successRate24h * 100)}%` : '—'
          }
          icon={TrendingUp}
          accent="text-primary"
          hint="trailing 24h"
          loading={isLoading}
        />
        <StatCard
          label="Active workers"
          value={data?.activeWorkers ?? 0}
          icon={Server}
          accent="text-state-running"
          loading={isLoading}
        />
        <StatCard
          label="Dead-lettered"
          value={data?.deadLettered24h ?? 0}
          icon={Skull}
          accent="text-state-dead"
          loading={isLoading}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Throughput</CardTitle>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <Legend color="bg-chart-1" label="Completed" />
              <Legend color="bg-state-failed" label="Failed" />
            </div>
          </CardHeader>
          <CardContent>
            {isLoading || !data ? (
              <Skeleton className="h-[260px] w-full" />
            ) : (
              <ThroughputChart data={data.throughput} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Jobs by status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading || !data
              ? Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-6 w-full" />
                ))
              : STATUS_ORDER.map((status) => {
                  const count = data.jobsByStatus[status]
                  const pct = total ? (count / total) * 100 : 0
                  return (
                    <div key={status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <StatusBadge status={status} />
                        <span className="tabular-nums text-muted-foreground">
                          {count}
                        </span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', STATUS_BAR[status])}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
          </CardContent>
        </Card>
      </div>

      {topAdvisories.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">AI advisories</CardTitle>
            <Link
              to="/advisories"
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {topAdvisories.map((a) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg border border-border/60 bg-muted/30 p-3"
              >
                <span
                  className={cn(
                    'mt-1 size-2 shrink-0 rounded-full',
                    a.severity === 'critical'
                      ? 'bg-state-dead'
                      : a.severity === 'warning'
                        ? 'bg-state-failed'
                        : 'bg-state-running',
                  )}
                />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {a.recommendation}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn('size-2 rounded-full', color)} />
      {label}
    </span>
  )
}
