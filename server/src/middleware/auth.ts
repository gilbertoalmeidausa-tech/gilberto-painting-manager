import type { MiddlewareHandler } from 'hono'
import { verifyAccessToken } from '../lib/auth'

// Variables stored on Hono context — every route handler reads from these
export interface AuthVariables {
  userId: string
  orgId: string
  role: 'owner' | 'admin' | 'employee'
  plan: 'free_trial' | 'basic' | 'pro' | 'team'
}

export const authGuard: MiddlewareHandler = async (c, next) => {
  const authorization = c.req.header('Authorization')
  if (!authorization?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  const token = authorization.slice(7)
  try {
    const payload = await verifyAccessToken(token)
    c.set('userId' as never, payload.sub)
    c.set('orgId' as never, payload.orgId)
    c.set('role' as never, payload.role)
    c.set('plan' as never, payload.plan)
    await next()
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }
}

export const adminGuard: MiddlewareHandler = async (c, next) => {
  const role = c.get('role' as never) as string
  if (role !== 'owner' && role !== 'admin') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
}

export const ownerGuard: MiddlewareHandler = async (c, next) => {
  const role = c.get('role' as never) as string
  if (role !== 'owner') {
    return c.json({ error: 'Forbidden' }, 403)
  }
  await next()
}
