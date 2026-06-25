import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { AuthUser, Plan } from '@painting/shared'
import { login, register, logout, refreshSession } from '../lib/auth'

interface AuthUserFull extends AuthUser {
  orgName: string
  planStatus: string
  trialEndsAt: string | null
}

interface AuthContextValue {
  user: AuthUserFull | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (email: string, password: string) => Promise<void>
  register: (payload: { name: string; email: string; password: string; companyName: string }) => Promise<void>
  logout: () => Promise<void>
  plan: Plan | null
  isTrialing: boolean
  trialDaysLeft: number | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUserFull | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // On mount, attempt to restore session via refresh token (httpOnly cookie)
  useEffect(() => {
    refreshSession()
      .then((data) => {
        if (data) setUser(data.user as AuthUserFull)
      })
      .finally(() => setIsLoading(false))
  }, [])

  // Listen for 401 events (emitted by apiFetch on token expiry)
  useEffect(() => {
    const handle = async () => {
      const data = await refreshSession()
      if (!data) {
        setUser(null)
      } else {
        setUser(data.user as AuthUserFull)
      }
    }
    window.addEventListener('auth:unauthorized', handle)
    return () => window.removeEventListener('auth:unauthorized', handle)
  }, [])

  const handleLogin = useCallback(async (email: string, password: string) => {
    const data = await login(email, password)
    setUser(data.user as AuthUserFull)
  }, [])

  const handleRegister = useCallback(
    async (payload: { name: string; email: string; password: string; companyName: string }) => {
      const data = await register(payload)
      setUser(data.user as AuthUserFull)
    },
    [],
  )

  const handleLogout = useCallback(async () => {
    await logout()
    setUser(null)
  }, [])

  const isTrialing = user?.planStatus === 'trialing'

  const trialDaysLeft = (() => {
    if (!isTrialing || !user?.trialEndsAt) return null
    const diff = new Date(user.trialEndsAt).getTime() - Date.now()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  })()

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login: handleLogin,
        register: handleRegister,
        logout: handleLogout,
        plan: (user?.plan as Plan) ?? null,
        isTrialing,
        trialDaysLeft,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
