import { useState } from 'react'
import { RotateCcw, Skull } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { PageHeader } from '@/components/page-header'
import { JobDetailSheet } from '@/components/jobs/job-detail-sheet'
import { JobTypeCell } from '@/lib/job-presentation'
import { useToast } from '@/components/toaster'
import { useJobs, useQueues, useRetryJob } from '@/hooks/queries'
import { relativeTime } from '@/lib/format'
import type { Job } from '@/types/api'

export function DeadLetterPage() {
  const { data, isLoading } = useJobs({ status: 'dead', pageSize: 100 })
  const { data: queues } = useQueues()
  const retry = useRetryJob()
  const toast = useToast()

  const [selected, setSelected] = useState<Job | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const jobs = data?.data ?? []
  const queueNames = Object.fromEntries(
    (queues ?? []).map((q) => [q.id, q.name]),
  )

  function replay(job: Job) {
    retry.mutate(job.id, {
      onSuccess: () => toast({ title: 'Replayed', description: job.id }),
      onError: () => toast({ title: 'Replay failed', variant: 'destructive' }),
    })
  }

  return (
    <div>
      <PageHeader
        title="Dead-letter"
        description="Jobs that exhausted their retries. Inspect the failure, then replay."
      />

      <Card>
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <Skull className="size-5" />
            </div>
            <p className="text-sm font-medium">No dead-lettered jobs</p>
            <p className="text-sm text-muted-foreground">
              Everything that failed is still within its retry budget.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Job</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Queue</TableHead>
                <TableHead className="text-right">Attempts</TableHead>
                <TableHead>Last error</TableHead>
                <TableHead className="text-right">Failed</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow
                  key={job.id}
                  className="cursor-pointer"
                  onClick={() => {
                    setSelected(job)
                    setSheetOpen(true)
                  }}
                >
                  <TableCell className="font-mono text-xs">{job.id}</TableCell>
                  <TableCell>
                    <JobTypeCell type={job.type} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {queueNames[job.queueId] ?? job.queueId}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-state-dead">
                    {job.attempts}/{job.maxAttempts}
                  </TableCell>
                  <TableCell className="max-w-[240px]">
                    {job.lastError ? (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block truncate font-mono text-xs text-state-failed">
                            {job.lastError}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          {job.lastError}
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                    {relativeTime(job.updatedAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={retry.isPending}
                      onClick={(e) => {
                        e.stopPropagation()
                        replay(job)
                      }}
                    >
                      <RotateCcw /> Replay
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      <JobDetailSheet
        job={selected}
        queueName={selected ? queueNames[selected.queueId] : undefined}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />
    </div>
  )
}
