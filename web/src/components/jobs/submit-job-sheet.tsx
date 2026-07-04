import { useEffect, useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/components/toaster'
import { useCreateJob, useQueues } from '@/hooks/queries'
import { JOB_TYPE_META, JOB_TYPES } from '@/lib/job-presentation'
import { prettyJson } from '@/lib/format'
import type { CreateJobRequest, JobType } from '@/types/api'

type ScheduleMode = 'immediate' | 'delayed' | 'cron'

const PAYLOAD_TEMPLATES: Record<JobType, Record<string, unknown>> = {
  http_request: {
    method: 'POST',
    url: 'https://api.example.com/webhook',
    body: {},
  },
  email: { to: 'user@example.com', subject: 'Hello', template: 'welcome' },
  data_export: { dataset: 'invoices', format: 'csv' },
  image_transform: { sourceUrl: 's3://bucket/in.png', width: 800, height: 600 },
  report: { reportKind: 'revenue', rangeStart: '2026-01-01', rangeEnd: '2026-06-30' },
}

interface SubmitJobSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SubmitJobSheet({ open, onOpenChange }: SubmitJobSheetProps) {
  const { data: queues } = useQueues()
  const createJob = useCreateJob()
  const toast = useToast()

  const [queueId, setQueueId] = useState('')
  const [type, setType] = useState<JobType>('http_request')
  const [payload, setPayload] = useState(prettyJson(PAYLOAD_TEMPLATES.http_request))
  const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('immediate')
  const [scheduledFor, setScheduledFor] = useState('')
  const [cron, setCron] = useState('*/15 * * * *')
  const [priority, setPriority] = useState('0')
  const [maxAttempts, setMaxAttempts] = useState('5')
  const [error, setError] = useState<string | null>(null)

  // Default the queue once queues load.
  useEffect(() => {
    if (!queueId && queues?.length) setQueueId(queues[0].id)
  }, [queues, queueId])

  function onTypeChange(next: JobType) {
    // Only overwrite payload if the user hasn't diverged from the template.
    const current = payload.trim()
    const isTemplate = JOB_TYPES.some(
      (t) => current === prettyJson(PAYLOAD_TEMPLATES[t]),
    )
    setType(next)
    if (isTemplate || current === '') {
      setPayload(prettyJson(PAYLOAD_TEMPLATES[next]))
    }
  }

  function reset() {
    setScheduleMode('immediate')
    setScheduledFor('')
    setPriority('0')
    setMaxAttempts('5')
    setError(null)
  }

  function submit() {
    setError(null)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(payload)
    } catch {
      setError('Payload is not valid JSON.')
      return
    }
    if (!queueId) {
      setError('Pick a queue.')
      return
    }
    if (scheduleMode === 'delayed' && !scheduledFor) {
      setError('Pick a run time.')
      return
    }

    const request: CreateJobRequest = {
      queueId,
      type,
      payload: parsed,
      priority: Number(priority) || 0,
      maxAttempts: Number(maxAttempts) || 5,
      scheduledFor:
        scheduleMode === 'delayed'
          ? new Date(scheduledFor).toISOString()
          : undefined,
      cron: scheduleMode === 'cron' ? cron : undefined,
    }

    createJob.mutate(request, {
      onSuccess: (job) => {
        toast({ title: 'Job submitted', description: job.id })
        reset()
        onOpenChange(false)
      },
      onError: () =>
        toast({ title: 'Failed to submit job', variant: 'destructive' }),
    })
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col gap-0 p-0">
        <SheetHeader className="border-b">
          <SheetTitle>Submit a job</SheetTitle>
          <SheetDescription>
            Enqueue a new job. It becomes eligible immediately, on a delay, or on
            a cron schedule.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-6">
          <Field label="Queue">
            <Select value={queueId} onValueChange={setQueueId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a queue" />
              </SelectTrigger>
              <SelectContent>
                {queues?.map((q) => (
                  <SelectItem key={q.id} value={q.id}>
                    {q.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Type">
            <Select
              value={type}
              onValueChange={(v) => onTypeChange(v as JobType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {JOB_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {JOB_TYPE_META[t].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Payload (JSON)">
            <Textarea
              value={payload}
              onChange={(e) => setPayload(e.target.value)}
              className="min-h-32 font-mono text-xs"
              spellCheck={false}
            />
          </Field>

          <Field label="Schedule">
            <Select
              value={scheduleMode}
              onValueChange={(v) => setScheduleMode(v as ScheduleMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="immediate">Run immediately</SelectItem>
                <SelectItem value="delayed">Run at a time</SelectItem>
                <SelectItem value="cron">Recurring (cron)</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          {scheduleMode === 'delayed' && (
            <Field label="Run at">
              <Input
                type="datetime-local"
                value={scheduledFor}
                onChange={(e) => setScheduledFor(e.target.value)}
              />
            </Field>
          )}

          {scheduleMode === 'cron' && (
            <Field label="Cron expression">
              <Input
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                className="font-mono"
                placeholder="*/15 * * * *"
              />
            </Field>
          )}

          <div className="grid grid-cols-2 gap-4">
            <Field label="Priority">
              <Input
                type="number"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
              />
            </Field>
            <Field label="Max attempts">
              <Input
                type="number"
                min={1}
                value={maxAttempts}
                onChange={(e) => setMaxAttempts(e.target.value)}
              />
            </Field>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t p-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={createJob.isPending}>
            {createJob.isPending ? 'Submitting…' : 'Submit job'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  )
}
