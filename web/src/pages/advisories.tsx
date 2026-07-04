import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { PageHeader } from '@/components/page-header'
import { AdvisoryCard } from '@/components/advisories/advisory-card'
import { useToast } from '@/components/toaster'
import { useAckAdvisory, useAdvisories, useQueues } from '@/hooks/queries'
import type { Advisory } from '@/types/api'

type TabValue = 'active' | 'acknowledged' | 'all'

export function AdvisoriesPage() {
  const { data: advisories, isLoading } = useAdvisories()
  const { data: queues } = useQueues()
  const ack = useAckAdvisory()
  const toast = useToast()
  const [tab, setTab] = useState<TabValue>('active')

  const queueNames = Object.fromEntries(
    (queues ?? []).map((q) => [q.id, q.name]),
  )
  const all = advisories ?? []
  const active = all.filter((a) => !a.acknowledged)

  const visible: Advisory[] =
    tab === 'active'
      ? active
      : tab === 'acknowledged'
        ? all.filter((a) => a.acknowledged)
        : all

  function acknowledge(id: string) {
    ack.mutate(id, {
      onSuccess: () => toast({ title: 'Advisory acknowledged' }),
      onError: () =>
        toast({ title: 'Could not acknowledge', variant: 'destructive' }),
    })
  }

  return (
    <div>
      <PageHeader
        title="AI Advisories"
        description="Recommendations from the advisory loop to heal failures — advisory only, never on the hot path."
      />

      <div className="mb-4 flex items-center justify-between">
        <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
          <TabsList>
            <TabsTrigger value="active">Active ({active.length})</TabsTrigger>
            <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-lg" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-16 text-center">
            <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </div>
            <p className="text-sm font-medium">
              {tab === 'active' ? 'No active advisories' : 'Nothing here'}
            </p>
            <p className="max-w-sm text-sm text-muted-foreground">
              The advisory loop watches for flaky jobs, retry waste, and capacity
              pressure. New recommendations appear here in real time.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {visible.map((advisory) => (
            <AdvisoryCard
              key={advisory.id}
              advisory={advisory}
              queueName={
                advisory.queueId ? queueNames[advisory.queueId] : undefined
              }
              onAcknowledge={acknowledge}
              acknowledging={ack.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
