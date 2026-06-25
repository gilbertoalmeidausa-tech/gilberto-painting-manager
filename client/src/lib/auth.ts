import { apiFetch, setAccessToken } from './api'
import type { AuthUser } from '@painting/shared'

export interface LoginResponse {
  data: {
    accessToken: string
    user: AuthUser & { orgName: string; planStatus: string; trialEndsAt: string | null }
  }
}

export async function login(email: string, password: string): Promise<LoginResponse['data']> {
  const res = await apiFetch<LoginResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
    skipAuth: true,
  })
  setAccessToken(res.data.accessToken)
  return res.data
}

export async function register(payload: {
  name: string
  email: string
  password: string
  companyName: string
}): Promise<LoginResponse['data']> {
  const res = await apiFetch<LoginResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
    skipAuth: true,
  })
  setAccessToken(res.data.accessToken)
  return res.data
}

export async function refreshSession(): Promise<LoginResponse['data'] | null> {
  try {
    const res = await apiFetch<LoginResponse>('/api/auth/refresh', {
      method: 'POST',
      skipAuth: true,
    })
    setAccessToken(res.data.accessToken)
    return res.data
  } catch {
    setAccessToken(null)
    return null
  }
}

export async function logout(): Promise<void> {
  try {
    await apiFetch('/api/auth/logout', { method: 'POST' })
  } finally {
    setAccessToken(null)
  }
}
