import { Cpu, Server, Waves } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { PageHeader } from '@/components/page-header'
import { StatCard } from '@/components/stat-card'
import { WorkerStatusBadge } from '@/components/status-badge'
import { useWorkers } from '@/hooks/queries'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Worker } from '@/types/api'

export function WorkersPage() {
  const { data: workers, isLoading } = useWorkers()

  const active = workers?.filter((w) => w.status === 'active').length ?? 0
  const draining = workers?.filter((w) => w.status === 'draining').length ?? 0
  const inFlight = workers?.reduce((s, w) => s + w.inFlight, 0) ?? 0

  return (
    <div>
      <PageHeader
        title="Fleet"
        description="Live workers, heartbeats, leases, and in-flight jobs."
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Active workers"
          value={active}
          icon={Server}
          accent="text-state-completed"
          loading={isLoading}
        />
        <StatCard
          label="Draining"
          value={draining}
          icon={Waves}
          accent="text-state-failed"
          loading={isLoading}
        />
        <StatCard
          label="Jobs in flight"
          value={inFlight}
          icon={Cpu}
          accent="text-state-running"
          loading={isLoading}
        />
        <StatCard
          label="Fleet size"
          value={workers?.length ?? 0}
          icon={Server}
          loading={isLoading}
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {workers?.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      )}
    </div>
  )
}

function WorkerCard({ worker }: { worker: Worker }) {
  const utilization = Math.min(
    100,
    (worker.inFlight / worker.concurrency) * 100,
  )

  return (
    <Card>
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-mono text-sm font-medium">
              {worker.hostname}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              pid {worker.pid} · v{worker.version}
            </p>
          </div>
          <WorkerStatusBadge status={worker.status} />
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">In flight</span>
            <span className="tabular-nums">
              {worker.inFlight} / {worker.concurrency}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-500',
                utilization >= 90 ? 'bg-state-failed' : 'bg-primary',
              )}
              style={{ width: `${Math.max(utilization, 2)}%` }}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {worker.queues.map((q) => (
            <Badge key={q} variant="secondary" className="font-mono text-[11px]">
              {q}
            </Badge>
          ))}
        </div>

        <div className="flex items-center justify-between border-t pt-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span
              className={cn(
                'size-1.5 rounded-full',
                worker.status === 'offline'
                  ? 'bg-muted-foreground'
                  : 'animate-pulse-dot bg-state-completed',
              )}
            />
            heartbeat {relativeTime(worker.lastHeartbeatAt)}
          </span>
          <span>up {relativeTime(worker.startedAt).replace(' ago', '')}</span>
        </div>
      </CardContent>
    </Card>
  )
}
