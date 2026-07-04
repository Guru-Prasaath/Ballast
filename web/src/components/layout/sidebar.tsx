import { Brand } from './brand'
import { NavList } from './nav-list'
import { LiveIndicator } from './live-indicator'

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card/40 md:flex">
      <div className="flex h-14 items-center border-b px-5">
        <Brand />
      </div>
      <NavList />
      <div className="flex items-center justify-between border-t px-4 py-3">
        <LiveIndicator />
        <span className="text-xs text-muted-foreground">v0.4.1</span>
      </div>
    </aside>
  )
}
