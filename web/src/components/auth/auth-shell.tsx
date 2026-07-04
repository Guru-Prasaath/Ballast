import { Brand } from '@/components/layout/brand'

interface AuthShellProps {
  title: string
  subtitle: string
  children: React.ReactNode
  footer: React.ReactNode
}

/** Centered card layout shared by the login and signup screens. */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Brand />
        </div>
        <div className="rounded-xl border bg-card p-6 shadow-sm">
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          <div className="mt-6">{children}</div>
        </div>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          {footer}
        </p>
      </div>
    </div>
  )
}
