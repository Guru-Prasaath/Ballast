import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { JobsTable } from './jobs-table'
import type { Job } from '@/types/api'

function makeJob(overrides: Partial<Job> = {}): Job {
  return {
    id: 'job_abc',
    queueId: 'q_default',
    projectId: 'proj_1',
    type: 'http_request',
    status: 'running',
    payload: {},
    priority: 0,
    attempts: 1,
    maxAttempts: 5,
    scheduledFor: null,
    cron: null,
    leaseExpiresAt: null,
    claimedBy: 'worker_1',
    lastError: null,
    result: null,
    createdAt: '2026-07-04T12:00:00.000Z',
    updatedAt: '2026-07-04T12:00:00.000Z',
    startedAt: '2026-07-04T12:00:00.000Z',
    completedAt: null,
    ...overrides,
  }
}

const queueNames = { q_default: 'default' }

describe('JobsTable', () => {
  it('renders a row per job with id, status, and queue name', () => {
    render(
      <JobsTable
        jobs={[makeJob(), makeJob({ id: 'job_xyz', status: 'dead' })]}
        queueNames={queueNames}
        onSelect={() => {}}
      />,
    )

    expect(screen.getByText('job_abc')).toBeInTheDocument()
    expect(screen.getByText('job_xyz')).toBeInTheDocument()
    expect(screen.getByText('Running')).toBeInTheDocument()
    expect(screen.getByText('Dead-letter')).toBeInTheDocument()
    expect(screen.getAllByText('default')).toHaveLength(2)
  })

  it('shows attempts as current/max', () => {
    render(
      <JobsTable
        jobs={[makeJob({ attempts: 3, maxAttempts: 5 })]}
        queueNames={queueNames}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText('3')).toBeInTheDocument()
    expect(screen.getByText('/5')).toBeInTheDocument()
  })

  it('calls onSelect with the clicked job', async () => {
    const onSelect = vi.fn()
    const job = makeJob()
    render(
      <JobsTable jobs={[job]} queueNames={queueNames} onSelect={onSelect} />,
    )

    await userEvent.click(screen.getByText('job_abc'))
    expect(onSelect).toHaveBeenCalledWith(job)
  })
})
