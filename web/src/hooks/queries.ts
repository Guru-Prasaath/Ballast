/**
 * TanStack Query hooks — the read/write surface the UI consumes. Query keys are
 * centralized so mutations can invalidate precisely.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import { apiClient } from '@/lib/api-client'
import type {
  Advisory,
  CreateJobRequest,
  Job,
  JobAttempt,
  JobFilter,
  OverviewStats,
  Paginated,
  Project,
  Queue,
  RetryPolicy,
  Worker,
} from '@/types/api'

export const queryKeys = {
  overview: ['overview'] as const,
  projects: ['projects'] as const,
  queues: ['queues'] as const,
  queue: (id: string) => ['queues', id] as const,
  retryPolicies: ['retry-policies'] as const,
  jobs: (filter: JobFilter) => ['jobs', filter] as const,
  job: (id: string) => ['jobs', id] as const,
  jobAttempts: (id: string) => ['jobs', id, 'attempts'] as const,
  workers: ['workers'] as const,
  advisories: ['advisories'] as const,
}

function toQueryString(filter: JobFilter): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(filter)) {
    if (value !== undefined && value !== '') params.set(key, String(value))
  }
  const s = params.toString()
  return s ? `?${s}` : ''
}

export function useOverview() {
  return useQuery({
    queryKey: queryKeys.overview,
    queryFn: ({ signal }) =>
      apiClient.get<OverviewStats>('/overview', signal),
  })
}

export function useProjects() {
  return useQuery({
    queryKey: queryKeys.projects,
    queryFn: ({ signal }) => apiClient.get<Project[]>('/projects', signal),
  })
}

export function useQueues() {
  return useQuery({
    queryKey: queryKeys.queues,
    queryFn: ({ signal }) => apiClient.get<Queue[]>('/queues', signal),
  })
}

export function useRetryPolicies() {
  return useQuery({
    queryKey: queryKeys.retryPolicies,
    queryFn: ({ signal }) =>
      apiClient.get<RetryPolicy[]>('/retry-policies', signal),
  })
}

export function useJobs(filter: JobFilter) {
  return useQuery({
    queryKey: queryKeys.jobs(filter),
    queryFn: ({ signal }) =>
      apiClient.get<Paginated<Job>>(`/jobs${toQueryString(filter)}`, signal),
  })
}

export function useJob(id: string) {
  return useQuery({
    queryKey: queryKeys.job(id),
    queryFn: ({ signal }) => apiClient.get<Job>(`/jobs/${id}`, signal),
    enabled: Boolean(id),
  })
}

export function useJobAttempts(id: string) {
  return useQuery({
    queryKey: queryKeys.jobAttempts(id),
    queryFn: ({ signal }) =>
      apiClient.get<JobAttempt[]>(`/jobs/${id}/attempts`, signal),
    enabled: Boolean(id),
  })
}

export function useWorkers() {
  return useQuery({
    queryKey: queryKeys.workers,
    queryFn: ({ signal }) => apiClient.get<Worker[]>('/workers', signal),
  })
}

export function useAdvisories() {
  return useQuery({
    queryKey: queryKeys.advisories,
    queryFn: ({ signal }) => apiClient.get<Advisory[]>('/advisories', signal),
  })
}

export function useCreateJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateJobRequest) =>
      apiClient.post<Job>('/jobs', input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: queryKeys.overview })
      qc.invalidateQueries({ queryKey: queryKeys.queues })
    },
  })
}

export function useRetryJob() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.post<Job>(`/jobs/${id}/retry`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] })
      qc.invalidateQueries({ queryKey: queryKeys.overview })
    },
  })
}

export function useAckAdvisory() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      apiClient.post<Advisory>(`/advisories/${id}/ack`),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.advisories }),
  })
}

export function useUpdateQueue() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: { paused?: boolean; concurrencyLimit?: number } }) =>
      apiClient.patch<Queue>(`/queues/${id}`, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.queues }),
  })
}

export function useUpdateRetryPolicy() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<RetryPolicy> }) =>
      apiClient.patch<RetryPolicy>(`/retry-policies/${id}`, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.retryPolicies }),
  })
}

