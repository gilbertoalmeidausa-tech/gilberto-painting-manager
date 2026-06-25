import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, ilike, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { projects } from '../db/schema'
import { authGuard } from '../middleware/auth'
import { enforcePlanLimit } from '../middleware/planLimits'
import { createAuditLog } from '../lib/audit'
import { HttpError } from '../lib/errors'
import { paginationSchema } from '@painting/shared'

const projectsRoutes = new Hono()
projectsRoutes.use('*', authGuard)

const projectSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: z.string().uuid().optional(),
  description: z.string().optional(),
  status: z.enum(['lead', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  totalValueCents: z.number().int().min(0).optional(),
  notes: z.string().optional(),
})

projectsRoutes.get(
  '/',
  zValidator('query', paginationSchema.extend({
    q: z.string().optional(),
    status: z.enum(['lead', 'active', 'on_hold', 'completed', 'cancelled']).optional(),
    clientId: z.string().uuid().optional(),
  })),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const { page, limit, q, status, clientId } = c.req.valid('query')
    const offset = (page - 1) * limit

    const conditions = [eq(projects.organizationId, orgId)]
    if (status) conditions.push(eq(projects.status, status))
    if (clientId) conditions.push(eq(projects.clientId, clientId))
    if (q) conditions.push(ilike(projects.name, `%${q}%`))

    const where = and(...conditions)

    const [rows, [{ total }]] = await Promise.all([
      db.query.projects.findMany({
        where,
        limit,
        offset,
        with: { client: true },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      }),
      db.select({ total: count() }).from(projects).where(where),
    ])

    return c.json({ data: rows, meta: { page, limit, total } })
  },
)

projectsRoutes.get('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const { id } = c.req.param()

  const project = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.organizationId, orgId)),
    with: {
      client: true,
      proposals: { orderBy: (t, { desc }) => [desc(t.createdAt)] },
      contracts: { orderBy: (t, { desc }) => [desc(t.createdAt)] },
      invoices: { orderBy: (t, { desc }) => [desc(t.createdAt)] },
      photos: { orderBy: (t, { asc }) => [asc(t.sortOrder)] },
    },
  })
  if (!project) throw new HttpError(404, 'Project not found')

  return c.json({ data: project })
})

projectsRoutes.post(
  '/',
  enforcePlanLimit('projects'),
  zValidator('json', projectSchema),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const userId = c.get('userId' as never) as string
    const body = c.req.valid('json')

    const [project] = await db
      .insert(projects)
      .values({
        ...body,
        organizationId: orgId,
        createdBy: userId,
        startDate: body.startDate ? new Date(body.startDate) : undefined,
        endDate: body.endDate ? new Date(body.endDate) : undefined,
      })
      .returning()

    await createAuditLog({
      orgId, userId, action: 'project.created',
      resourceType: 'project', resourceId: project.id, after: project,
    })

    return c.json({ data: project }, 201)
  },
)

projectsRoutes.put('/:id', zValidator('json', projectSchema.partial()), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const { id } = c.req.param()
  const body = c.req.valid('json')

  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Project not found')

  const [updated] = await db
    .update(projects)
    .set({
      ...body,
      startDate: body.startDate ? new Date(body.startDate) : undefined,
      endDate: body.endDate ? new Date(body.endDate) : undefined,
      updatedAt: new Date(),
    })
    .where(and(eq(projects.id, id), eq(projects.organizationId, orgId)))
    .returning()

  await createAuditLog({
    orgId, userId, action: 'project.updated',
    resourceType: 'project', resourceId: id, before: existing, after: updated,
  })

  return c.json({ data: updated })
})

projectsRoutes.delete('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const role = c.get('role' as never) as string
  const { id } = c.req.param()

  if (role === 'employee') throw new HttpError(403, 'Employees cannot delete projects')

  const existing = await db.query.projects.findFirst({
    where: and(eq(projects.id, id), eq(projects.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Project not found')

  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.organizationId, orgId)))

  await createAuditLog({
    orgId, userId, action: 'project.deleted',
    resourceType: 'project', resourceId: id, before: existing,
  })

  return c.body(null, 204)
})

export { projectsRoutes }
