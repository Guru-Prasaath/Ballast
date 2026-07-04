import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CalendarClock,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Brand } from '@/components/layout/brand'
import { ThemeToggle } from '@/components/theme-toggle'
import { useAuth } from '@/app/auth-provider'

const FEATURES = [
  {
    icon: ShieldCheck,
    title: 'Exactly-once execution',
    body: 'Atomic claims with SELECT … FOR UPDATE SKIP LOCKED. Two workers never run the same job — proven under concurrent load.',
  },
  {
    icon: HeartPulse,
    title: 'Survives crashes',
    body: 'Every claim takes a lease; a reaper returns expired-lease jobs to the queue. Kill a worker mid-job and the work still completes.',
  },
  {
    icon: RefreshCw,
    title: 'Retries & dead-letter',
    body: 'Failed jobs retry with fixed, linear, or exponential backoff (with jitter), then dead-letter once attempts are exhausted.',
  },
  {
    icon: Gauge,
    title: 'Per-queue concurrency',
    body: 'Each queue enforces its own concurrency limit across the whole fleet, so a noisy queue can’t starve the rest.',
  },
  {
    icon: CalendarClock,
    title: 'Delayed & cron jobs',
    body: 'Schedule a job for later or on a cron expression. A promoter makes them eligible the moment they’re due.',
  },
  {
    icon: Sparkles,
    title: 'AI advisory loop',
    body: 'An advisory service watches for flaky jobs and retry waste and recommends fixes — always off the hot path.',
  },
]

export function LandingPage() {
  const { status } = useAuth()
  const authed = status === 'authenticated'

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Brand />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {authed ? (
              <Button asChild size="sm">
                <Link to="/app">
                  Open dashboard <ArrowRight />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild variant="ghost" size="sm">
                  <Link to="/login">Sign in</Link>
                </Button>
                <Button asChild size="sm">
                  <Link to="/signup">Get started</Link>
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 max-w-4xl rounded-full bg-primary/20 blur-3xl"
        />
        <div className="mx-auto max-w-3xl px-5 py-24 text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 animate-pulse-dot rounded-full bg-state-completed" />
            Distributed job scheduler
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-5xl">
            Background jobs that run{' '}
            <span className="text-primary">exactly once.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
            Ballast runs your background work across a fleet of workers —
            surviving crashes, retrying with backoff, and never running a job
            twice. With a live dashboard to watch it all.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link to={authed ? '/app' : '/signup'}>
                {authed ? 'Open dashboard' : 'Get started'} <ArrowRight />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to={authed ? '/app' : '/login'}>
                {authed ? 'Go to app' : 'Sign in'}
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border/60 bg-card p-6"
            >
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <f.icon className="size-5" />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-5 py-16 text-center">
          <LayoutDashboard className="size-8 text-primary" />
          <h2 className="text-2xl font-semibold tracking-tight">
            Watch your fleet work in real time
          </h2>
          <p className="max-w-lg text-muted-foreground">
            Submit jobs, inspect attempts, replay dead-letters, and monitor
            worker heartbeats from one dashboard.
          </p>
          <Button asChild size="lg" className="mt-2">
            <Link to={authed ? '/app' : '/signup'}>
              {authed ? 'Open dashboard' : 'Create your workspace'} <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-border/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-6 text-sm text-muted-foreground">
          <Brand />
          <span>Built with NestJS, Postgres, and React.</span>
        </div>
      </footer>
    </div>
  )
}
