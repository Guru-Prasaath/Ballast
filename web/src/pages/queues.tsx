import { useState } from 'react'
import { PlayCircle, PauseCircle, Settings2 } from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PageHeader } from '@/components/page-header'
import { useQueues, useRetryPolicies, useUpdateQueue, useUpdateRetryPolicy } from '@/hooks/queries'
import { cn } from '@/lib/utils'
import type { JobStatus, Queue, RetryPolicy } from '@/types/api'

const STAT_ROWS: { key: keyof Queue['stats']; label: string; dot: string }[] = [
  { key: 'running', label: 'Running', dot: 'bg-state-running' },
  { key: 'ready', label: 'Ready', dot: 'bg-state-ready' },
  { key: 'scheduled', label: 'Scheduled', dot: 'bg-state-scheduled' },
  { key: 'completed', label: 'Completed', dot: 'bg-state-completed' },
  { key: 'failed', label: 'Failed', dot: 'bg-state-failed' },
  { key: 'dead', label: 'Dead', dot: 'bg-state-dead' },
]

function policySummary(p: RetryPolicy): string {
  const base = p.baseDelayMs >= 1000 ? `${p.baseDelayMs / 1000}s` : `${p.baseDelayMs}ms`
  return `${p.maxAttempts} attempts · ${p.backoff} from ${base}${p.jitter ? ' · jitter' : ''}`
}

export function QueuesPage() {
  const { data: queues, isLoading } = useQueues()
  const { data: policies } = useRetryPolicies()
  const policyById = Object.fromEntries((policies ?? []).map((p) => [p.id, p]))

  return (
    <div>
      <PageHeader
        title="Queues"
        description="Concurrency limits, retry policies, and per-queue health."
      />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-64 w-full rounded-lg" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {queues?.map((queue) => (
            <QueueCard
              key={queue.id}
              queue={queue}
              policy={policyById[queue.retryPolicyId]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function QueueCard({ queue, policy }: { queue: Queue; policy?: RetryPolicy }) {
  const [isEditing, setIsEditing] = useState(false)
  const [concurrency, setConcurrency] = useState(queue.concurrencyLimit.toString())
  
  const updateQueue = useUpdateQueue()
  
  const utilization = Math.min(
    100,
    (queue.stats.running / queue.concurrencyLimit) * 100,
  )
  const total = (Object.values(queue.stats) as number[]).reduce(
    (s, n) => s + n,
    0,
  )

  const handleSave = () => {
    updateQueue.mutate({ id: queue.id, updates: { concurrencyLimit: parseInt(concurrency, 10) } })
    setIsEditing(false)
  }

  const togglePause = () => {
    updateQueue.mutate({ id: queue.id, updates: { paused: !queue.paused } })
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-mono text-base font-semibold">{queue.name}</h3>
            {queue.paused && (
              <Badge variant="secondary" className="gap-1">
                <PauseCircle className="size-3" /> Paused
              </Badge>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {total} jobs total
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={togglePause} title={queue.paused ? "Resume Queue" : "Pause Queue"}>
            {queue.paused ? <PlayCircle className="size-4" /> : <PauseCircle className="size-4" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsEditing(!isEditing)} title="Edit Configuration">
            <Settings2 className="size-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isEditing ? (
          <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">Concurrency Limit</Label>
              <Input 
                type="number" 
                value={concurrency} 
                onChange={(e) => setConcurrency(e.target.value)} 
                className="h-8 text-sm"
              />
            </div>
            {/* Minimal UI for policy edits can be added here if needed */}
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>Save</Button>
            </div>
          </div>
        ) : (
          <div>
            <div className="mb-1 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Concurrency</span>
              <span className="tabular-nums">
                {queue.stats.running} / {queue.concurrencyLimit}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className={cn(
                  'h-full rounded-full',
                  utilization >= 100 ? 'bg-state-failed' : 'bg-primary',
                )}
                style={{ width: `${Math.max(utilization, 3)}%` }}
              />
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {STAT_ROWS.map((row) => (
            <div key={row.key} className="flex items-center gap-2">
              <span className={cn('size-1.5 rounded-full', row.dot)} />
              <span className="text-muted-foreground">{row.label}</span>
              <span className="ml-auto tabular-nums">
                {queue.stats[row.key as JobStatus]}
              </span>
            </div>
          ))}
        </div>

        {policy && (
          <div className="rounded-lg border border-border/60 bg-muted/30 p-3">
            <p className="text-xs font-medium">{policy.name}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {policySummary(policy)}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
