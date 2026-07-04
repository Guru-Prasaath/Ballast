import { useLive } from '@/app/live-provider'
import { cn } from '@/lib/utils'

/** Small pulse showing the live-events connection state. */
export function LiveIndicator({ className }: { className?: string }) {
  const { status } = useLive()
  const live = status === 'live'
  return (
    <span
      className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          live ? 'animate-pulse-dot bg-state-completed' : 'bg-state-failed',
        )}
      />
      {live ? 'Live' : 'Connecting…'}
    </span>
  )
}
