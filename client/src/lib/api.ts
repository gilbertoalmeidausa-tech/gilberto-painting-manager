// Base API fetch wrapper — auth token injection added in Step 3.
// All API calls go through this function so we can intercept 401s.

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

let accessToken: string | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken(): string | null {
  return accessToken
}

interface FetchOptions extends RequestInit {
  skipAuth?: boolean
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth = false, ...init } = options

  const headers = new Headers(init.headers)

  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }

  if (!skipAuth && accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const res = await fetch(path, {
    ...init,
    headers,
    credentials: 'include', // send httpOnly cookie for refresh token
  })

  if (res.status === 401 && !skipAuth) {
    // Attempt silent refresh — implemented in Step 3
    window.dispatchEvent(new CustomEvent('auth:unauthorized'))
    throw new ApiError(401, 'Unauthorized')
  }

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try {
      const body = await res.json()
      message = body.error ?? message
    } catch {}
    throw new ApiError(res.status, message)
  }

  // 204 No Content
  if (res.status === 204) return undefined as T

  return res.json() as Promise<T>
}
