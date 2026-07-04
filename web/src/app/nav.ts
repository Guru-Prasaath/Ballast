import {
  Anchor,
  CalendarClock,
  LayoutDashboard,
  ListChecks,
  Server,
  Skull,
  Sparkles,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  /** Exact-match routing (used for the index route). */
  end?: boolean
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Overview', to: '/app', icon: LayoutDashboard, end: true },
  { label: 'Jobs', to: '/app/jobs', icon: ListChecks },
  { label: 'Queues', to: '/app/queues', icon: Anchor },
  { label: 'Scheduled', to: '/app/scheduled', icon: CalendarClock },
  { label: 'Dead-letter', to: '/app/dead-letter', icon: Skull },
  { label: 'Fleet', to: '/app/workers', icon: Server },
  { label: 'AI Advisories', to: '/app/advisories', icon: Sparkles },
]
