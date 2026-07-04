import { cn } from '@/lib/utils'
import type { JobStatus, WorkerStatus } from '@/types/api'

/**
 * Full, literal class strings per status so Tailwind's JIT can see them.
 * Never build these by interpolation — the classes would be purged.
 */
const JOB_STATUS_STYLES: Record<JobStatus, { dot: string; text: string }> = {
  scheduled: { dot: 'bg-state-scheduled', text: 'text-state-scheduled' },
  ready: { dot: 'bg-state-ready', text: 'text-state-ready' },
  running: { dot: 'bg-state-running', text: 'text-state-running' },
  completed: { dot: 'bg-state-completed', text: 'text-state-completed' },
  failed: { dot: 'bg-state-failed', text: 'text-state-failed' },
  dead: { dot: 'bg-state-dead', text: 'text-state-dead' },
}

const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  scheduled: 'Scheduled',
  ready: 'Ready',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  dead: 'Dead-letter',
}

const WORKER_STATUS_STYLES: Record<WorkerStatus, { dot: string; text: string }> =
  {
    active: { dot: 'bg-state-completed', text: 'text-state-completed' },
    idle: { dot: 'bg-state-ready', text: 'text-state-ready' },
    draining: { dot: 'bg-state-failed', text: 'text-state-failed' },
    offline: { dot: 'bg-muted-foreground', text: 'text-muted-foreground' },
  }

const WORKER_STATUS_LABELS: Record<WorkerStatus, string> = {
  active: 'Active',
  idle: 'Idle',
  draining: 'Draining',
  offline: 'Offline',
}

interface StatusBadgeProps {
  status: JobStatus
  className?: string
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const styles = JOB_STATUS_STYLES[status]
  const pulse = status === 'running'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium',
        styles.text,
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          styles.dot,
          pulse && 'animate-pulse-dot',
        )}
      />
      {JOB_STATUS_LABELS[status]}
    </span>
  )
}

interface WorkerStatusBadgeProps {
  status: WorkerStatus
  className?: string
}

export function WorkerStatusBadge({
  status,
  className,
}: WorkerStatusBadgeProps) {
  const styles = WORKER_STATUS_STYLES[status]
  const pulse = status === 'active'
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-2 py-0.5 text-xs font-medium',
        styles.text,
        className,
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          styles.dot,
          pulse && 'animate-pulse-dot',
        )}
      />
      {WORKER_STATUS_LABELS[status]}
    </span>
  )
}
