import { ZodError } from 'zod'
import type { Context } from 'hono'
import { env } from '../env'

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

export function notFound(resource: string): HttpError {
  return new HttpError(404, `${resource} not found`)
}

export function forbidden(): HttpError {
  return new HttpError(403, 'Forbidden')
}

export function errorHandler(err: Error, c: Context) {
  if (err instanceof ZodError) {
    return c.json({ error: 'Validation error', issues: err.flatten().fieldErrors }, 422)
  }
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status as 400 | 403 | 404 | 409 | 422 | 500)
  }
  console.error('[Unhandled error]', err)
  if (env.NODE_ENV === 'production') {
    return c.json({ error: 'Internal server error' }, 500)
  }
  return c.json({ error: err.message, stack: err.stack }, 500)
}
