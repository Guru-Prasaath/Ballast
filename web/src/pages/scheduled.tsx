import { useState } from 'react'
import { CalendarClock, Repeat } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { PageHeader } from '@/components/page-header'
import { JobDetailSheet } from '@/components/jobs/job-detail-sheet'
import { JobTypeCell } from '@/lib/job-presentation'
import { useJobs, useQueues } from '@/hooks/queries'
import { dateTime, relativeTime } from '@/lib/format'
import type { Job } from '@/types/api'

export function ScheduledPage() {
  const { data, isLoading } = useJobs({ status: 'scheduled', pageSize: 100 })
  const { data: queues } = useQueues()
  const [selected, setSelected] = useState<Job | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const jobs = data?.data ?? []
  const queueNames = Object.fromEntries(
    (queues ?? []).map((q) => [q.id, q.name]),
  )
  const recurring = jobs.filter((j) => j.cron).length

  return (
    <div>
      <PageHeader
        title="Scheduled"
        description="Delayed and recurring jobs waiting to become eligible."
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
              <CalendarClock className="size-5" />
            </div>
            <p className="text-sm font-medium">Nothing scheduled</p>
            <p className="text-sm text-muted-foreground">
              Delayed and cron jobs will appear here before they run.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-4 border-b px-4 py-2.5 text-xs text-muted-foreground">
              <span>{jobs.length} scheduled</span>
              <span className="flex items-center gap-1.5">
                <Repeat className="size-3.5" /> {recurring} recurring
              </span>
            </div>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Job</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Queue</TableHead>
                  <TableHead>Trigger</TableHead>
                  <TableHead className="text-right">Next run</TableHead>
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
                    <TableCell>
                      {job.cron ? (
                        <Badge variant="secondary" className="gap-1 font-mono">
                          <Repeat className="size-3" />
                          {job.cron}
                        </Badge>
                      ) : (
                        <Badge variant="outline">One-shot</Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {job.scheduledFor ? (
                        <span title={dateTime(job.scheduledFor)}>
                          {relativeTime(job.scheduledFor)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
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
