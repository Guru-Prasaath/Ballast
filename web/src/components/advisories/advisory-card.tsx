import {
  AlertOctagon,
  AlertTriangle,
  Check,
  Info,
  Lightbulb,
  type LucideIcon,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { relativeTime } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Advisory, AdvisoryKind, AdvisorySeverity } from '@/types/api'

const SEVERITY_META: Record<
  AdvisorySeverity,
  { icon: LucideIcon; text: string; ring: string; label: string }
> = {
  critical: {
    icon: AlertOctagon,
    text: 'text-state-dead',
    ring: 'bg-state-dead/10',
    label: 'Critical',
  },
  warning: {
    icon: AlertTriangle,
    text: 'text-state-failed',
    ring: 'bg-state-failed/10',
    label: 'Warning',
  },
  info: {
    icon: Info,
    text: 'text-state-running',
    ring: 'bg-state-running/10',
    label: 'Info',
  },
}

const KIND_LABELS: Record<AdvisoryKind, string> = {
  retry_tuning: 'Retry tuning',
  flaky_detection: 'Flaky detection',
  anomaly: 'Anomaly',
  capacity: 'Capacity',
}

interface AdvisoryCardProps {
  advisory: Advisory
  queueName?: string
  onAcknowledge: (id: string) => void
  acknowledging?: boolean
}

export function AdvisoryCard({
  advisory,
  queueName,
  onAcknowledge,
  acknowledging,
}: AdvisoryCardProps) {
  const severity = SEVERITY_META[advisory.severity]
  const Icon = severity.icon
  const confidence = Math.round(advisory.confidence * 100)

  return (
    <Card className={cn(advisory.acknowledged && 'opacity-60')}>
      <CardContent className="flex gap-4 p-5">
        <div
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg',
            severity.ring,
            severity.text,
          )}
        >
          <Icon className="size-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold">{advisory.title}</h3>
            <Badge variant="secondary" className="text-[11px]">
              {KIND_LABELS[advisory.kind]}
            </Badge>
            {queueName && (
              <Badge variant="outline" className="font-mono text-[11px]">
                {queueName}
              </Badge>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {relativeTime(advisory.createdAt)}
            </span>
          </div>

          <p className="mt-1.5 text-sm text-muted-foreground">
            {advisory.summary}
          </p>

          <div className="mt-3 flex items-start gap-2 rounded-lg border border-border/60 bg-muted/30 p-3">
            <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" />
            <p className="text-sm">{advisory.recommendation}</p>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${confidence}%` }}
                />
              </div>
              <span className="text-xs font-medium tabular-nums">
                {confidence}%
              </span>
            </div>

            <div className="ml-auto">
              {advisory.acknowledged ? (
                <span className="flex items-center gap-1.5 text-xs font-medium text-state-completed">
                  <Check className="size-3.5" /> Acknowledged
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={acknowledging}
                  onClick={() => onAcknowledge(advisory.id)}
                >
                  Acknowledge
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
