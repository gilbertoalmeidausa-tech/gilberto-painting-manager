import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/Spinner'
import { ApiError } from '../lib/api'
import { useState, useEffect } from 'react'
import { getCachedLogoUrl } from '../hooks/useLogo'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
})
type FormValues = z.infer<typeof schema>

function LoginPage() {
  const { login, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const [cachedLogoUrl, setCachedLogoUrl] = useState<string | null>(null)

  useEffect(() => {
    setCachedLogoUrl(getCachedLogoUrl())
  }, [])

  if (isAuthenticated) {
    navigate({ to: '/dashboard', replace: true })
    return null
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
  })

  async function onSubmit(values: FormValues) {
    setServerError('')
    try {
      await login(values.email, values.password)
      navigate({ to: '/dashboard', replace: true })
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Login failed. Try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 overflow-hidden">
            {cachedLogoUrl ? (
              <img src={cachedLogoUrl} alt="Company logo" className="w-full h-full object-contain" />
            ) : (
              <div className="flex w-full h-full items-center justify-center bg-brand-500 rounded-xl">
                <span className="text-white text-xl font-bold">G</span>
              </div>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Gilberto Pro Painting</h1>
          <p className="text-gray-500 mt-1 text-sm">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              {...register('email')}
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="input"
            />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <input
              {...register('password')}
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              className="input"
            />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center">
            {isSubmitting ? <Spinner size="sm" /> : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-600 font-medium hover:underline">
            Start free trial
          </Link>
        </p>
      </div>
    </div>
  )
}
