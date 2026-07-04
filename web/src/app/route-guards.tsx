import { Navigate, useLocation } from 'react-router-dom'
import { AppLayout } from '@/components/layout/app-layout'
import { LiveProvider } from '@/app/live-provider'
import { useAuth } from '@/app/auth-provider'

/**
 * Guards the app shell: unauthenticated visitors are redirected to /login with
 * the attempted path preserved so they land back where they intended. The live
 * feed only runs behind the gate.
 */
export function ProtectedLayout() {
  const { status } = useAuth()
  const location = useLocation()

  if (status === 'unauthenticated') {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return (
    <LiveProvider>
      <AppLayout />
    </LiveProvider>
  )
}

/** Keeps authenticated users out of the login/signup screens. */
export function PublicOnly({ children }: { children: React.ReactNode }) {
  const { status } = useAuth()
  if (status === 'authenticated') return <Navigate to="/" replace />
  return <>{children}</>
}
