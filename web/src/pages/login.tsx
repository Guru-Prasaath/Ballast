import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { AuthShell } from '@/components/auth/auth-shell'
import { useAuth } from '@/app/auth-provider'
import { DEMO_CREDENTIALS } from '@/lib/config'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/app'

  // Prefill the shared demo account so reviewers can sign in with one click.
  const [email, setEmail] = useState(DEMO_CREDENTIALS.email)
  const [password, setPassword] = useState(DEMO_CREDENTIALS.password)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await login({ email, password })
      navigate(from, { replace: true })
    } catch {
      setError('Could not sign in. Check your credentials and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to Ballast."
      footer={
        <>
          Don&apos;t have an account?{' '}
          <Link to="/signup" className="font-medium text-primary hover:underline">
            Create one
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Signing in…' : 'Sign in'}
        </Button>

        <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-center text-xs text-muted-foreground">
          <p className="font-medium text-foreground">Reviewer demo account</p>
          <p className="mt-0.5">
            <span className="font-mono">{DEMO_CREDENTIALS.email}</span> ·{' '}
            <span className="font-mono">{DEMO_CREDENTIALS.password}</span>
          </p>
          <p className="mt-0.5">Prefilled — just click Sign in, or create your own.</p>
          <p className="mt-2 text-[11px] text-muted-foreground/80">
            Note: On free-tier hosting, the first sign in may take ~60s due to a cold start.
          </p>
        </div>
      </form>
    </AuthShell>
  )
}
