import { NavLink } from 'react-router-dom'
import { Anchor } from 'lucide-react'
import { cn } from '@/lib/utils'
import { NAV_ITEMS } from '@/app/nav'

export function Sidebar() {
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r bg-card/40 md:flex">
      <div className="flex h-14 items-center gap-2 border-b px-5">
        <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Anchor className="size-4" />
        </div>
        <span className="text-base font-semibold tracking-tight">Ballast</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground',
              )
            }
          >
            <item.icon className="size-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2">
          <span className="size-1.5 animate-pulse-dot rounded-full bg-state-completed" />
          Mock API · v0.4.1
        </div>
      </div>
    </aside>
  )
}
