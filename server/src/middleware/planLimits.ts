import type { MiddlewareHandler } from 'hono'
import { db } from '../db'
import { clients, projects, organizationMembers } from '../db/schema'
import { eq, count } from 'drizzle-orm'
import { PLAN_LIMITS } from '@painting/shared'

type LimitedResource = 'clients' | 'projects' | 'members'

function getLimit(plan: string, resource: LimitedResource): number | null {
  const limits = PLAN_LIMITS[plan as keyof typeof PLAN_LIMITS]
  if (!limits) return null
  if (resource === 'clients') return limits.maxClients
  if (resource === 'projects') return limits.maxProjects
  if (resource === 'members') return limits.maxMembers
  return null
}

export function enforcePlanLimit(resource: LimitedResource): MiddlewareHandler {
  return async (c, next) => {
    const orgId = c.get('orgId' as never) as string
    const plan = c.get('plan' as never) as string
    const limit = getLimit(plan, resource)

    if (limit === null) {
      // Unlimited on this plan
      await next()
      return
    }

    let currentCount = 0

    if (resource === 'clients') {
      const [row] = await db
        .select({ count: count() })
        .from(clients)
        .where(eq(clients.organizationId, orgId))
      currentCount = row?.count ?? 0
    } else if (resource === 'projects') {
      const [row] = await db
        .select({ count: count() })
        .from(projects)
        .where(eq(projects.organizationId, orgId))
      currentCount = row?.count ?? 0
    } else if (resource === 'members') {
      const [row] = await db
        .select({ count: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.organizationId, orgId))
      currentCount = row?.count ?? 0
    }

    if (currentCount >= limit) {
      return c.json(
        {
          error: `Your ${plan} plan allows a maximum of ${limit} ${resource}. Upgrade to add more.`,
        },
        403,
      )
    }

    await next()
  }
}
