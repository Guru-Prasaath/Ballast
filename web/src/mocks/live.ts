/**
 * Mock live-events source. Stands in for the real WebSocket feed during
 * frontend-first development, emitting typed `WsEvent`s on a timer. When the
 * core API ships its WebSocket gateway, this file is replaced by a real socket
 * client and consumers (see `LiveProvider`) are unchanged.
 */
import type { Advisory, WsEvent } from '@/types/api'
import { db } from './db'

type Listener = (event: WsEvent) => void

export interface LiveSocket {
  subscribe: (listener: Listener) => () => void
  close: () => void
}

const EXTRA_ADVISORIES: Omit<Advisory, 'id' | 'createdAt'>[] = [
  {
    kind: 'anomaly',
    severity: 'warning',
    title: 'email queue latency spiked',
    summary:
      'p95 processing time on the "emails" queue rose 3.1× in the last 10 minutes.',
    recommendation:
      'Check the downstream email provider; consider shedding low-priority sends.',
    confidence: 0.68,
    jobId: null,
    queueId: 'q_emails',
    acknowledged: false,
  },
  {
    kind: 'capacity',
    severity: 'info',
    title: 'default queue backlog clearing',
    summary: 'The "default" queue backlog fell below its concurrency limit.',
    recommendation: 'No action needed; autoscaling can scale in.',
    confidence: 0.6,
    jobId: null,
    queueId: 'q_default',
    acknowledged: false,
  },
]

export function createMockLiveSocket(): LiveSocket {
  const listeners = new Set<Listener>()
  const timers: ReturnType<typeof setInterval>[] = []
  let advisoryCursor = 0

  const emit = (event: WsEvent) => listeners.forEach((l) => l(event))

  // Worker heartbeats — patch a random active/idle worker every ~3s.
  timers.push(
    setInterval(() => {
      const live = db.workers.filter((w) => w.status !== 'offline')
      if (live.length === 0) return
      const worker = live[Math.floor(Math.random() * live.length)]
      const jitter = Math.round((Math.random() - 0.5) * 2)
      const inFlight = Math.max(
        0,
        Math.min(worker.concurrency, worker.inFlight + jitter),
      )
      const updated = {
        ...worker,
        inFlight: worker.status === 'idle' ? 0 : inFlight,
        lastHeartbeatAt: new Date().toISOString(),
      }
      worker.inFlight = updated.inFlight
      worker.lastHeartbeatAt = updated.lastHeartbeatAt
      emit({ type: 'worker.heartbeat', at: updated.lastHeartbeatAt, payload: updated })
    }, 3000),
  )

  // Occasional new advisory (~every 40s).
  timers.push(
    setInterval(() => {
      const template = EXTRA_ADVISORIES[advisoryCursor % EXTRA_ADVISORIES.length]
      advisoryCursor += 1
      const advisory: Advisory = {
        ...template,
        id: `adv_live_${advisoryCursor}`,
        createdAt: new Date().toISOString(),
      }
      db.advisories.unshift(advisory)
      emit({ type: 'advisory.created', at: advisory.createdAt, payload: advisory })
    }, 40000),
  )

  return {
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close() {
      timers.forEach(clearInterval)
      listeners.clear()
    },
  }
}
