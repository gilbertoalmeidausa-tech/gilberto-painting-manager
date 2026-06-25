import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useAuth } from '../hooks/useAuth'
import { Spinner } from '../components/Spinner'
import { ApiError } from '../lib/api'
import { registerSchema, type RegisterInput } from '@painting/shared'
import { useState } from 'react'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

function RegisterPage() {
  const { register: registerUser, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')

  if (isAuthenticated) {
    navigate({ to: '/dashboard', replace: true })
    return null
  }

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  })

  async function onSubmit(values: RegisterInput) {
    setServerError('')
    try {
      await registerUser(values)
      navigate({ to: '/dashboard', replace: true })
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Registration failed. Try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <div className="card p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-brand-500 rounded-xl mb-4">
            <span className="text-white text-xl font-bold">G</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Start your free trial</h1>
          <p className="text-gray-500 mt-1 text-sm">14 days free, no credit card required</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {serverError && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {serverError}
            </div>
          )}

          <div>
            <label className="label">Your name</label>
            <input {...register('name')} type="text" autoComplete="name" placeholder="Gilberto Silva" className="input" />
            {errors.name && <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>}
          </div>

          <div>
            <label className="label">Company name</label>
            <input {...register('companyName')} type="text" placeholder="Gilberto Pro Painting" className="input" />
            {errors.companyName && <p className="mt-1 text-xs text-red-600">{errors.companyName.message}</p>}
          </div>

          <div>
            <label className="label">Email</label>
            <input {...register('email')} type="email" autoComplete="email" placeholder="you@example.com" className="input" />
            {errors.email && <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="label">Password</label>
            <input {...register('password')} type="password" autoComplete="new-password" placeholder="Min. 8 characters" className="input" />
            {errors.password && <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>}
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-primary w-full justify-center">
            {isSubmitting ? <Spinner size="sm" /> : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
