import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/hooks/queries'
import { useToast } from '@/components/toaster'
import type { Worker } from '@/types/api'

type LiveStatus = 'connecting' | 'live'

interface LiveContextValue {
  status: LiveStatus
  lastEventAt: number | null
}

const LiveContext = createContext<LiveContextValue>({
  status: 'connecting',
  lastEventAt: null,
})

/**
 * Connects to the live-events feed and applies events to the TanStack Query
 * cache, so the dashboard updates without polling. Today the feed is a mock
 * socket; swapping in a real WebSocket touches only `createMockLiveSocket`.
 */
export function LiveProvider({ children }: { children: React.ReactNode }) {
  const queryClient = useQueryClient()
  const toast = useToast()
  const [status, setStatus] = useState<LiveStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState<number | null>(null)
  const toastRef = useRef(toast)
  toastRef.current = toast

  useEffect(() => {
    if (!import.meta.env.DEV) return
    let active = true
    let cleanup: (() => void) | undefined

    import('@/mocks/live').then(({ createMockLiveSocket }) => {
      if (!active) return
      const socket = createMockLiveSocket()
      setStatus('live')

      const unsubscribe = socket.subscribe((event) => {
        setLastEventAt(Date.now())
        switch (event.type) {
          case 'worker.heartbeat': {
            const worker = event.payload
            queryClient.setQueryData<Worker[]>(queryKeys.workers, (prev) =>
              prev?.map((w) => (w.id === worker.id ? worker : w)),
            )
            break
          }
          case 'advisory.created': {
            queryClient.invalidateQueries({ queryKey: queryKeys.advisories })
            toastRef.current({
              title: 'New AI advisory',
              description: event.payload.title,
            })
            break
          }
          default:
            break
        }
      })

      cleanup = () => {
        unsubscribe()
        socket.close()
      }
    })

    return () => {
      active = false
      cleanup?.()
    }
  }, [queryClient])

  return (
    <LiveContext.Provider value={{ status, lastEventAt }}>
      {children}
    </LiveContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLive() {
  return useContext(LiveContext)
}
