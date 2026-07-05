/**
 * Thin typed fetch wrapper around the Ballast API. All data access goes through
 * here so swapping the mock (MSW) layer for the real core API is a no-op for
 * callers. The access token is injected from module state set at login.
 */
import { API_BASE } from './config'

const BASE = API_BASE

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

interface RequestOptions {
  method?: string
  body?: unknown
  signal?: AbortSignal
}

let isRefreshing = false
let refreshQueue: Array<(token: string | null) => void> = []

async function processQueue(token: string | null) {
  refreshQueue.forEach((cb) => cb(token))
  refreshQueue = []
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`

  let res = await fetch(`${BASE}${path}`, {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    signal: opts.signal,
  })

  // Intercept 401 Unauthorized for token refresh
  if (res.status === 401 && path !== '/auth/refresh' && path !== '/auth/login') {
    if (!isRefreshing) {
      isRefreshing = true
      try {
        const refreshRes = await fetch(`${BASE}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
        
        if (refreshRes.ok) {
          const data = await refreshRes.json()
          setAccessToken(data.accessToken)
          await processQueue(data.accessToken)
        } else {
          setAccessToken(null)
          await processQueue(null)
          // Clear the stale session to break the redirect loop
          localStorage.removeItem('ballast-session')
          window.location.href = '/login'
        }
      } catch (err) {
        setAccessToken(null)
        await processQueue(null)
        localStorage.removeItem('ballast-session')
        window.location.href = '/login'
      } finally {
        isRefreshing = false
      }
    }

    // Wait for the refresh to complete
    const newToken = await new Promise<string | null>((resolve) => {
      refreshQueue.push(resolve)
    })

    if (newToken) {
      // Retry original request with new token
      headers.Authorization = `Bearer ${newToken}`
      res = await fetch(`${BASE}${path}`, {
        method: opts.method ?? 'GET',
        headers,
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      })
    }
  }

  if (!res.ok) {
    let message = res.statusText
    try {
      const data = await res.json()
      if (data?.message) message = data.message
    } catch {
      // no JSON body; keep statusText
    }
    throw new ApiError(res.status, message)
  }

  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

export const apiClient = {
  get: <T>(path: string, signal?: AbortSignal) =>
    request<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
