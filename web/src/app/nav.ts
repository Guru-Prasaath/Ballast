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
  { label: 'Overview', to: '/', icon: LayoutDashboard, end: true },
  { label: 'Jobs', to: '/jobs', icon: ListChecks },
  { label: 'Queues', to: '/queues', icon: Anchor },
  { label: 'Scheduled', to: '/scheduled', icon: CalendarClock },
  { label: 'Dead-letter', to: '/dead-letter', icon: Skull },
  { label: 'Fleet', to: '/workers', icon: Server },
  { label: 'AI Advisories', to: '/advisories', icon: Sparkles },
]
