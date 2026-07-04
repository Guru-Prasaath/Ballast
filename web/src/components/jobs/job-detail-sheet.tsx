import { RotateCcw } from 'lucide-react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { useToast } from '@/components/toaster'
import { JOB_TYPE_META } from '@/lib/job-presentation'
import { dateTime, duration, prettyJson, relativeTime } from '@/lib/format'
import { useJobAttempts, useRetryJob } from '@/hooks/queries'
import { cn } from '@/lib/utils'
import type { Job } from '@/types/api'

interface JobDetailSheetProps {
  job: Job | null
  queueName?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function JobDetailSheet({
  job,
  queueName,
  open,
  onOpenChange,
}: JobDetailSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0">
        {job && (
          <JobDetail job={job} queueName={queueName} />
        )}
      </SheetContent>
    </Sheet>
  )
}

function JobDetail({ job, queueName }: { job: Job; queueName?: string }) {
  const { data: attempts, isLoading } = useJobAttempts(job.id)
  const retry = useRetryJob()
  const toast = useToast()
  const canRetry = job.status === 'failed' || job.status === 'dead'

  function onRetry() {
    retry.mutate(job.id, {
      onSuccess: () =>
        toast({ title: 'Job requeued', description: job.id }),
      onError: () =>
        toast({ title: 'Retry failed', variant: 'destructive' }),
    })
  }

  return (
    <>
      <SheetHeader className="border-b">
        <div className="flex items-center gap-3">
          <StatusBadge status={job.status} />
          <SheetTitle className="font-mono text-base">{job.id}</SheetTitle>
        </div>
        <SheetDescription>
          {JOB_TYPE_META[job.type].label} · created {relativeTime(job.createdAt)}
        </SheetDescription>
        {canRetry && (
          <div className="mt-2">
            <Button
              size="sm"
              variant="outline"
              disabled={retry.isPending}
              onClick={onRetry}
            >
              <RotateCcw />
              {retry.isPending ? 'Requeuing…' : 'Retry job'}
            </Button>
          </div>
        )}
      </SheetHeader>

      <Tabs defaultValue="overview" className="flex min-h-0 flex-1 flex-col">
        <div className="px-6 pt-4">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="payload">Payload</TabsTrigger>
            <TabsTrigger value="attempts">
              Attempts{attempts ? ` (${attempts.length})` : ''}
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          <TabsContent value="overview">
            <dl className="divide-y divide-border/60 text-sm">
              <Row label="Queue" value={queueName ?? job.queueId} />
              <Row label="Type" value={JOB_TYPE_META[job.type].label} />
              <Row
                label="Attempts"
                value={`${job.attempts} / ${job.maxAttempts}`}
              />
              <Row label="Priority" value={String(job.priority)} />
              {job.cron && <Row label="Cron" value={job.cron} mono />}
              {job.scheduledFor && (
                <Row label="Scheduled for" value={dateTime(job.scheduledFor)} />
              )}
              {job.leaseExpiresAt && (
                <Row
                  label="Lease expires"
                  value={dateTime(job.leaseExpiresAt)}
                />
              )}
              {job.claimedBy && (
                <Row label="Claimed by" value={job.claimedBy} mono />
              )}
              <Row label="Created" value={dateTime(job.createdAt)} />
              {job.completedAt && (
                <Row label="Completed" value={dateTime(job.completedAt)} />
              )}
              {job.lastError && (
                <Row label="Last error" value={job.lastError} error />
              )}
            </dl>
          </TabsContent>

          <TabsContent value="payload">
            <pre className="overflow-x-auto rounded-lg border bg-muted/40 p-4 font-mono text-xs leading-relaxed">
              {prettyJson(job.payload)}
            </pre>
          </TabsContent>

          <TabsContent value="attempts">
            {isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : attempts && attempts.length > 0 ? (
              <ol className="space-y-3">
                {attempts.map((attempt) => (
                  <li
                    key={attempt.id}
                    className="rounded-lg border border-border/60 p-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">
                        Attempt {attempt.attemptNumber}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium',
                          attempt.status === 'succeeded'
                            ? 'text-state-completed'
                            : 'text-state-failed',
                        )}
                      >
                        {attempt.status}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{relativeTime(attempt.startedAt)}</span>
                      <Separator orientation="vertical" className="h-3" />
                      <span>{duration(attempt.durationMs)}</span>
                      {attempt.workerId && (
                        <>
                          <Separator orientation="vertical" className="h-3" />
                          <span className="font-mono">{attempt.workerId}</span>
                        </>
                      )}
                    </div>
                    {attempt.error && (
                      <p className="mt-2 rounded bg-state-failed/10 px-2 py-1 font-mono text-xs text-state-failed">
                        {attempt.error}
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No attempts yet.
              </p>
            )}
          </TabsContent>
        </div>
      </Tabs>
    </>
  )
}

function Row({
  label,
  value,
  mono,
  error,
}: {
  label: string
  value: string
  mono?: boolean
  error?: boolean
}) {
  return (
    <div className="flex justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          'text-right',
          mono && 'font-mono text-xs',
          error && 'text-state-failed',
        )}
      >
        {value}
      </dd>
    </div>
  )
}
