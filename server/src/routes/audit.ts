import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, desc } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { auditLogs } from '../db/schema'
import { authGuard } from '../middleware/auth'
import { HttpError } from '../lib/errors'
import { paginationSchema } from '@painting/shared'

const auditRoutes = new Hono()
auditRoutes.use('*', authGuard)

auditRoutes.get(
  '/',
  zValidator('query', paginationSchema.extend({ resourceType: z.string().optional() })),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const plan = c.get('plan' as never) as string
    const { page, limit, resourceType } = c.req.valid('query')

    if (plan !== 'pro' && plan !== 'team') {
      throw new HttpError(403, 'Audit logs require a Pro or Team plan')
    }

    const offset = (page - 1) * limit

    const conditions = [eq(auditLogs.organizationId, orgId)]
    if (resourceType) conditions.push(eq(auditLogs.resourceType, resourceType))

    const rows = await db.query.auditLogs.findMany({
      where: and(...conditions),
      limit,
      offset,
      orderBy: [desc(auditLogs.createdAt)],
      with: { },
    })

    return c.json({ data: rows, meta: { page, limit, total: rows.length } })
  },
)

export { auditRoutes }
