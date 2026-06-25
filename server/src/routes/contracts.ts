import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { contracts, organizationSettings } from '../db/schema'
import { authGuard } from '../middleware/auth'
import { createAuditLog } from '../lib/audit'
import { HttpError } from '../lib/errors'
import { paginationSchema } from '@painting/shared'

const contractsRoutes = new Hono()
contractsRoutes.use('*', authGuard)

const contractSchema = z.object({
  projectId: z.string().uuid().optional(),
  proposalId: z.string().uuid().optional(),
  title: z.string().min(1).max(255),
  status: z.enum(['draft', 'sent', 'signed', 'voided']).optional(),
  scopeOfWork: z.string().default(''),
  paymentTerms: z.string().default('[]'),
  termsAndConditions: z.string().default(''),
  signedByName: z.string().max(150).optional(),
  signedAt: z.string().datetime().optional(),
})

async function getNextContractNumber(orgId: string): Promise<string> {
  const settings = await db.query.organizationSettings.findFirst({
    where: eq(organizationSettings.organizationId, orgId),
  })
  const prefix = settings?.contractPrefix ?? 'C'
  const next = settings?.nextContractNumber ?? 1
  await db
    .update(organizationSettings)
    .set({ nextContractNumber: next + 1, updatedAt: new Date() })
    .where(eq(organizationSettings.organizationId, orgId))
  return `${prefix}-${String(next).padStart(3, '0')}`
}

contractsRoutes.get(
  '/',
  zValidator('query', paginationSchema.extend({ projectId: z.string().uuid().optional() })),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const { page, limit, projectId } = c.req.valid('query')
    const offset = (page - 1) * limit

    const conditions = [eq(contracts.organizationId, orgId)]
    if (projectId) conditions.push(eq(contracts.projectId, projectId))
    const where = and(...conditions)

    const [rows, [{ total }]] = await Promise.all([
      db.query.contracts.findMany({
        where,
        limit,
        offset,
        with: { project: { with: { client: true } }, proposal: true },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      }),
      db.select({ total: count() }).from(contracts).where(where),
    ])

    return c.json({ data: rows, meta: { page, limit, total } })
  },
)

contractsRoutes.get('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const { id } = c.req.param()

  const contract = await db.query.contracts.findFirst({
    where: and(eq(contracts.id, id), eq(contracts.organizationId, orgId)),
    with: { project: { with: { client: true } }, proposal: true },
  })
  if (!contract) throw new HttpError(404, 'Contract not found')

  return c.json({ data: contract })
})

contractsRoutes.post('/', zValidator('json', contractSchema), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const body = c.req.valid('json')

  const contractNumber = await getNextContractNumber(orgId)

  const [contract] = await db
    .insert(contracts)
    .values({
      ...body,
      organizationId: orgId,
      contractNumber,
      createdBy: userId,
      signedAt: body.signedAt ? new Date(body.signedAt) : undefined,
    })
    .returning()

  await createAuditLog({
    orgId, userId, action: 'contract.created',
    resourceType: 'contract', resourceId: contract.id, after: contract,
  })

  return c.json({ data: contract }, 201)
})

contractsRoutes.put('/:id', zValidator('json', contractSchema.partial()), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const { id } = c.req.param()
  const body = c.req.valid('json')

  const existing = await db.query.contracts.findFirst({
    where: and(eq(contracts.id, id), eq(contracts.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Contract not found')
  if (existing.status === 'voided') throw new HttpError(400, 'Cannot edit a voided contract')

  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() }
  if (body.signedAt) updates.signedAt = new Date(body.signedAt)
  if (body.status === 'signed') updates.signedAt = updates.signedAt ?? new Date()

  const [updated] = await db
    .update(contracts)
    .set(updates as Partial<typeof contracts.$inferInsert>)
    .where(and(eq(contracts.id, id), eq(contracts.organizationId, orgId)))
    .returning()

  await createAuditLog({
    orgId, userId, action: 'contract.updated',
    resourceType: 'contract', resourceId: id, before: existing, after: updated,
  })

  return c.json({ data: updated })
})

contractsRoutes.delete('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const { id } = c.req.param()

  const existing = await db.query.contracts.findFirst({
    where: and(eq(contracts.id, id), eq(contracts.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Contract not found')
  if (existing.status === 'signed') throw new HttpError(400, 'Cannot delete a signed contract')

  await db.delete(contracts).where(and(eq(contracts.id, id), eq(contracts.organizationId, orgId)))

  await createAuditLog({
    orgId, userId, action: 'contract.deleted',
    resourceType: 'contract', resourceId: id, before: existing,
  })

  return c.body(null, 204)
})

export { contractsRoutes }
