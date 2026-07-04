import { Construction } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader } from '@/components/page-header'

interface PlaceholderPageProps {
  title: string
  description: string
  phase: string
}

/**
 * Honest stand-in for views not yet built. Keeps navigation complete during
 * the frontend-first build without pretending a screen exists.
 */
export function PlaceholderPage({
  title,
  description,
  phase,
}: PlaceholderPageProps) {
  return (
    <div>
      <PageHeader title={title} description={description} />
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Construction className="size-6" />
          </div>
          <p className="text-sm font-medium">Coming in {phase}</p>
          <p className="max-w-sm text-sm text-muted-foreground">
            This screen is scaffolded and routed. Its UI lands in {phase} of the
            frontend-first roadmap.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
