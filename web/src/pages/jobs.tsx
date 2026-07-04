import { useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, Search, X } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PageHeader } from '@/components/page-header'
import { JobsTable } from '@/components/jobs/jobs-table'
import { JobDetailSheet } from '@/components/jobs/job-detail-sheet'
import { SubmitJobSheet } from '@/components/jobs/submit-job-sheet'
import { useJobs, useQueues } from '@/hooks/queries'
import { JOB_TYPE_META, JOB_TYPES } from '@/lib/job-presentation'
import type { Job, JobFilter, JobStatus, JobType } from '@/types/api'

const STATUSES: { value: JobStatus; label: string }[] = [
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'ready', label: 'Ready' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'dead', label: 'Dead-letter' },
]

const ALL = 'all'
const PAGE_SIZE = 25

export function JobsPage() {
  const [status, setStatus] = useState<string>(ALL)
  const [type, setType] = useState<string>(ALL)
  const [queueId, setQueueId] = useState<string>(ALL)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Job | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [submitOpen, setSubmitOpen] = useState(false)

  // Debounce the search box so we don't refetch on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300)
    return () => clearTimeout(id)
  }, [searchInput])

  // Any filter change resets to the first page.
  useEffect(() => {
    setPage(1)
  }, [status, type, queueId, search])

  const filter: JobFilter = {
    status: status === ALL ? undefined : (status as JobStatus),
    type: type === ALL ? undefined : (type as JobType),
    queueId: queueId === ALL ? undefined : queueId,
    search: search || undefined,
    page,
    pageSize: PAGE_SIZE,
  }

  const { data, isLoading, isFetching } = useJobs(filter)
  const { data: queues } = useQueues()

  const queueNames = useMemo(
    () => Object.fromEntries((queues ?? []).map((q) => [q.id, q.name])),
    [queues],
  )

  const jobs = data?.data ?? []
  const total = data?.total ?? 0
  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const end = Math.min(page * PAGE_SIZE, total)
  const hasFilters = status !== ALL || type !== ALL || queueId !== ALL || search

  function resetFilters() {
    setStatus(ALL)
    setType(ALL)
    setQueueId(ALL)
    setSearchInput('')
  }

  function openJob(job: Job) {
    setSelected(job)
    setSheetOpen(true)
  }

  return (
    <div>
      <PageHeader
        title="Jobs"
        description="Browse, filter, and inspect every job across your queues."
        actions={
          <Button onClick={() => setSubmitOpen(true)}>
            <Plus /> New job
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by id, type, or payload…"
            className="pl-8"
          />
        </div>

        <FilterSelect
          value={status}
          onChange={setStatus}
          placeholder="Status"
          options={STATUSES}
        />
        <FilterSelect
          value={type}
          onChange={setType}
          placeholder="Type"
          options={JOB_TYPES.map((t) => ({
            value: t,
            label: JOB_TYPE_META[t].label,
          }))}
        />
        <FilterSelect
          value={queueId}
          onChange={setQueueId}
          placeholder="Queue"
          options={(queues ?? []).map((q) => ({ value: q.id, label: q.name }))}
        />

        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            <X /> Clear
          </Button>
        )}
      </div>

      <Card>
        <JobsTable
          jobs={jobs}
          queueNames={queueNames}
          loading={isLoading}
          selectedId={selected?.id}
          onSelect={openJob}
        />
        {!isLoading && jobs.length === 0 && (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No jobs match these filters.
          </div>
        )}
        <div className="flex items-center justify-between border-t px-4 py-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {start}–{end} of {total}
            {isFetching && !isLoading && <span className="ml-2">·</span>}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-8"
              disabled={end >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>

      <JobDetailSheet
        job={selected}
        queueName={selected ? queueNames[selected.queueId] : undefined}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
      />

      <SubmitJobSheet open={submitOpen} onOpenChange={setSubmitOpen} />
    </div>
  )
}

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  options: { value: string; label: string }[]
}

function FilterSelect({
  value,
  onChange,
  placeholder,
  options,
}: FilterSelectProps) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[150px]">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>All {placeholder.toLowerCase()}s</SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
