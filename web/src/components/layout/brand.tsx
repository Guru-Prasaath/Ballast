import { Anchor } from 'lucide-react'

/** The Ballast wordmark + anchor glyph, shared across nav surfaces. */
export function Brand() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Anchor className="size-4" />
      </div>
      <span className="text-base font-semibold tracking-tight">Ballast</span>
    </div>
  )
}
