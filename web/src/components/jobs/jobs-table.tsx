import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusBadge } from '@/components/status-badge'
import { JobTypeCell } from '@/lib/job-presentation'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Job } from '@/types/api'

interface JobsTableProps {
  jobs: Job[]
  queueNames: Record<string, string>
  loading?: boolean
  selectedId?: string
  onSelect: (job: Job) => void
}

export function JobsTable({
  jobs,
  queueNames,
  loading,
  selectedId,
  onSelect,
}: JobsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead className="w-[130px]">Status</TableHead>
          <TableHead>Job</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Queue</TableHead>
          <TableHead className="text-right">Attempts</TableHead>
          <TableHead className="text-right">Created</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {loading
          ? Array.from({ length: 8 }).map((_, i) => (
              <TableRow key={i} className="hover:bg-transparent">
                {Array.from({ length: 6 }).map((__, j) => (
                  <TableCell key={j}>
                    <Skeleton className="h-5 w-full" />
                  </TableCell>
                ))}
              </TableRow>
            ))
          : jobs.map((job) => (
              <TableRow
                key={job.id}
                onClick={() => onSelect(job)}
                data-state={selectedId === job.id ? 'selected' : undefined}
                className="cursor-pointer"
              >
                <TableCell>
                  <StatusBadge status={job.status} />
                </TableCell>
                <TableCell className="font-mono text-xs">{job.id}</TableCell>
                <TableCell>
                  <JobTypeCell type={job.type} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {queueNames[job.queueId] ?? job.queueId}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span
                    className={cn(
                      job.attempts >= job.maxAttempts && 'text-state-dead',
                    )}
                  >
                    {job.attempts}
                  </span>
                  <span className="text-muted-foreground">
                    /{job.maxAttempts}
                  </span>
                </TableCell>
                <TableCell className="whitespace-nowrap text-right text-muted-foreground">
                  {relativeTime(job.createdAt)}
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  )
}
