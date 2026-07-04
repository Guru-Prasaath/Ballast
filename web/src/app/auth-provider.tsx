import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { apiClient, setAccessToken } from '@/lib/api-client'
import type { AuthSession, LoginRequest, SignupRequest } from '@/types/api'

type AuthStatus = 'authenticated' | 'unauthenticated'

interface AuthContextValue {
  status: AuthStatus
  session: AuthSession | null
  login: (input: LoginRequest) => Promise<void>
  signup: (input: SignupRequest) => Promise<void>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const STORAGE_KEY = 'ballast-session'

function loadStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

/**
 * Holds the authenticated session, persists it, and keeps the API client's
 * bearer token in sync. The stored session is trusted on reload; a real backend
 * would additionally validate/refresh it against /me on boot.
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(loadStoredSession)

  useEffect(() => {
    setAccessToken(session?.tokens.accessToken ?? null)
    if (session) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
    } else {
      localStorage.removeItem(STORAGE_KEY)
    }
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      status: session ? 'authenticated' : 'unauthenticated',
      session,
      login: async (input) => {
        setSession(await apiClient.post<AuthSession>('/auth/login', input))
      },
      signup: async (input) => {
        setSession(await apiClient.post<AuthSession>('/auth/signup', input))
      },
      logout: () => setSession(null),
    }),
    [session],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
