import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { proposals, organizationSettings } from '../db/schema'
import { authGuard } from '../middleware/auth'
import { createAuditLog } from '../lib/audit'
import { HttpError } from '../lib/errors'
import { paginationSchema } from '@painting/shared'

const proposalsRoutes = new Hono()
proposalsRoutes.use('*', authGuard)

const lineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number().min(0),
  unit: z.string().default(''),
  unitPriceCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
})

const paymentTermItemSchema = z.object({
  label: z.string(),
  percent: z.number().min(0).max(100),
  amountCents: z.number().int().min(0),
  dueWhen: z.string(),
})

const proposalSchema = z.object({
  projectId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  status: z.enum(['draft', 'sent', 'accepted', 'rejected', 'expired']).optional(),
  lineItems: z.array(lineItemSchema).default([]),
  subtotalCents: z.number().int().min(0).default(0),
  taxRateCents: z.number().int().min(0).default(0),
  taxAmountCents: z.number().int().min(0).default(0),
  discountAmountCents: z.number().int().min(0).default(0),
  totalCents: z.number().int().min(0).default(0),
  paymentTerms: z.array(paymentTermItemSchema).default([]),
  notes: z.string().optional(),
  validUntil: z.string().datetime().optional(),
})

async function getNextProposalNumber(orgId: string): Promise<string> {
  const settings = await db.query.organizationSettings.findFirst({
    where: eq(organizationSettings.organizationId, orgId),
  })
  const prefix = settings?.proposalPrefix ?? 'P'
  const next = settings?.nextProposalNumber ?? 1
  await db
    .update(organizationSettings)
    .set({ nextProposalNumber: next + 1, updatedAt: new Date() })
    .where(eq(organizationSettings.organizationId, orgId))
  return `${prefix}-${String(next).padStart(3, '0')}`
}

proposalsRoutes.get(
  '/',
  zValidator('query', paginationSchema.extend({ projectId: z.string().uuid().optional() })),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const { page, limit, projectId } = c.req.valid('query')
    const offset = (page - 1) * limit

    const conditions = [eq(proposals.organizationId, orgId)]
    if (projectId) conditions.push(eq(proposals.projectId, projectId))
    const where = and(...conditions)

    const [rows, [{ total }]] = await Promise.all([
      db.query.proposals.findMany({
        where,
        limit,
        offset,
        with: { project: { with: { client: true } } },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      }),
      db.select({ total: count() }).from(proposals).where(where),
    ])

    return c.json({ data: rows, meta: { page, limit, total } })
  },
)

proposalsRoutes.get('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const { id } = c.req.param()

  const proposal = await db.query.proposals.findFirst({
    where: and(eq(proposals.id, id), eq(proposals.organizationId, orgId)),
    with: { project: { with: { client: true } } },
  })
  if (!proposal) throw new HttpError(404, 'Proposal not found')

  return c.json({ data: proposal })
})

proposalsRoutes.post('/', zValidator('json', proposalSchema), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const body = c.req.valid('json')

  const proposalNumber = await getNextProposalNumber(orgId)

  const [proposal] = await db
    .insert(proposals)
    .values({
      ...body,
      organizationId: orgId,
      proposalNumber,
      createdBy: userId,
      lineItems: JSON.stringify(body.lineItems),
      paymentTerms: JSON.stringify(body.paymentTerms),
      validUntil: body.validUntil ? new Date(body.validUntil) : undefined,
    })
    .returning()

  await createAuditLog({
    orgId, userId, action: 'proposal.created',
    resourceType: 'proposal', resourceId: proposal.id, after: proposal,
  })

  return c.json({ data: proposal }, 201)
})

proposalsRoutes.put('/:id', zValidator('json', proposalSchema.partial()), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const { id } = c.req.param()
  const body = c.req.valid('json')

  const existing = await db.query.proposals.findFirst({
    where: and(eq(proposals.id, id), eq(proposals.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Proposal not found')

  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() }
  if (body.lineItems) updates.lineItems = JSON.stringify(body.lineItems)
  if (body.paymentTerms) updates.paymentTerms = JSON.stringify(body.paymentTerms)
  if (body.validUntil) updates.validUntil = new Date(body.validUntil)
  if (body.status === 'sent') updates.sentAt = new Date()
  if (body.status === 'accepted') updates.acceptedAt = new Date()
  if (body.status === 'rejected') updates.rejectedAt = new Date()

  const [updated] = await db
    .update(proposals)
    .set(updates as Partial<typeof proposals.$inferInsert>)
    .where(and(eq(proposals.id, id), eq(proposals.organizationId, orgId)))
    .returning()

  await createAuditLog({
    orgId, userId, action: 'proposal.updated',
    resourceType: 'proposal', resourceId: id, before: existing, after: updated,
  })

  return c.json({ data: updated })
})

proposalsRoutes.delete('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const { id } = c.req.param()

  const existing = await db.query.proposals.findFirst({
    where: and(eq(proposals.id, id), eq(proposals.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Proposal not found')
  if (existing.status === 'accepted') throw new HttpError(400, 'Cannot delete an accepted proposal')

  await db.delete(proposals).where(and(eq(proposals.id, id), eq(proposals.organizationId, orgId)))

  await createAuditLog({
    orgId, userId, action: 'proposal.deleted',
    resourceType: 'proposal', resourceId: id, before: existing,
  })

  return c.body(null, 204)
})

export { proposalsRoutes }
