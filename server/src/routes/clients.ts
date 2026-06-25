import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, ilike, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { clients } from '../db/schema'
import { authGuard } from '../middleware/auth'
import { enforcePlanLimit } from '../middleware/planLimits'
import { createAuditLog } from '../lib/audit'
import { HttpError } from '../lib/errors'
import { paginationSchema } from '@painting/shared'

const clientsRoutes = new Hono()
clientsRoutes.use('*', authGuard)

const clientSchema = z.object({
  name: z.string().min(1).max(150),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().max(30).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  notes: z.string().optional(),
})

// ─── List ─────────────────────────────────────────────────────────────────────

clientsRoutes.get('/', zValidator('query', paginationSchema.extend({ q: z.string().optional() })), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const { page, limit, q } = c.req.valid('query')
  const offset = (page - 1) * limit

  const where = q
    ? and(eq(clients.organizationId, orgId), ilike(clients.name, `%${q}%`))
    : eq(clients.organizationId, orgId)

  const [rows, [{ total }]] = await Promise.all([
    db.query.clients.findMany({
      where,
      limit,
      offset,
      orderBy: (t, { desc }) => [desc(t.createdAt)],
    }),
    db.select({ total: count() }).from(clients).where(where),
  ])

  return c.json({ data: rows, meta: { page, limit, total } })
})

// ─── Get one ──────────────────────────────────────────────────────────────────

clientsRoutes.get('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const { id } = c.req.param()

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.organizationId, orgId)),
    with: { projects: { orderBy: (t, { desc }) => [desc(t.createdAt)] } },
  })
  if (!client) throw new HttpError(404, 'Client not found')

  return c.json({ data: client })
})

// ─── Create ───────────────────────────────────────────────────────────────────

clientsRoutes.post('/', enforcePlanLimit('clients'), zValidator('json', clientSchema), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const body = c.req.valid('json')

  const [client] = await db
    .insert(clients)
    .values({ ...body, organizationId: orgId, createdBy: userId })
    .returning()

  await createAuditLog({
    orgId, userId, action: 'client.created',
    resourceType: 'client', resourceId: client.id,
    after: client, ipAddress: c.req.header('x-forwarded-for'),
  })

  return c.json({ data: client }, 201)
})

// ─── Update ───────────────────────────────────────────────────────────────────

clientsRoutes.put('/:id', zValidator('json', clientSchema.partial()), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const { id } = c.req.param()
  const body = c.req.valid('json')

  const existing = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Client not found')

  const [updated] = await db
    .update(clients)
    .set({ ...body, updatedAt: new Date() })
    .where(and(eq(clients.id, id), eq(clients.organizationId, orgId)))
    .returning()

  await createAuditLog({
    orgId, userId, action: 'client.updated',
    resourceType: 'client', resourceId: id,
    before: existing, after: updated, ipAddress: c.req.header('x-forwarded-for'),
  })

  return c.json({ data: updated })
})

// ─── Delete ───────────────────────────────────────────────────────────────────

clientsRoutes.delete('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const role = c.get('role' as never) as string
  const { id } = c.req.param()

  if (role === 'employee') throw new HttpError(403, 'Employees cannot delete clients')

  const existing = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Client not found')

  await db.delete(clients).where(and(eq(clients.id, id), eq(clients.organizationId, orgId)))

  await createAuditLog({
    orgId, userId, action: 'client.deleted',
    resourceType: 'client', resourceId: id,
    before: existing, ipAddress: c.req.header('x-forwarded-for'),
  })

  return c.body(null, 204)
})

export { clientsRoutes }
