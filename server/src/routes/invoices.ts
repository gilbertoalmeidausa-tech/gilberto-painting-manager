import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { invoices, organizationSettings } from '../db/schema'
import { authGuard } from '../middleware/auth'
import { createAuditLog } from '../lib/audit'
import { HttpError } from '../lib/errors'
import { paginationSchema } from '@painting/shared'

const invoicesRoutes = new Hono()
invoicesRoutes.use('*', authGuard)

const lineItemSchema = z.object({
  id: z.string(),
  description: z.string(),
  quantity: z.number().min(0),
  unit: z.string().default(''),
  unitPriceCents: z.number().int().min(0),
  totalCents: z.number().int().min(0),
})

const invoiceSchema = z.object({
  projectId: z.string().uuid().optional(),
  status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'voided']).optional(),
  lineItems: z.array(lineItemSchema).default([]),
  subtotalCents: z.number().int().min(0).default(0),
  taxRateCents: z.number().int().min(0).default(0),
  taxAmountCents: z.number().int().min(0).default(0),
  discountAmountCents: z.number().int().min(0).default(0),
  totalCents: z.number().int().min(0).default(0),
  amountPaidCents: z.number().int().min(0).default(0),
  amountDueCents: z.number().int().min(0).default(0),
  dueDate: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  notes: z.string().optional(),
})

async function getNextInvoiceNumber(orgId: string): Promise<string> {
  const settings = await db.query.organizationSettings.findFirst({
    where: eq(organizationSettings.organizationId, orgId),
  })
  const prefix = settings?.invoicePrefix ?? 'INV'
  const next = settings?.nextInvoiceNumber ?? 1
  await db
    .update(organizationSettings)
    .set({ nextInvoiceNumber: next + 1, updatedAt: new Date() })
    .where(eq(organizationSettings.organizationId, orgId))
  return `${prefix}-${String(next).padStart(4, '0')}`
}

invoicesRoutes.get(
  '/',
  zValidator('query', paginationSchema.extend({
    projectId: z.string().uuid().optional(),
    status: z.enum(['draft', 'sent', 'partial', 'paid', 'overdue', 'voided']).optional(),
  })),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const { page, limit, projectId, status } = c.req.valid('query')
    const offset = (page - 1) * limit

    const conditions = [eq(invoices.organizationId, orgId)]
    if (projectId) conditions.push(eq(invoices.projectId, projectId))
    if (status) conditions.push(eq(invoices.status, status))
    const where = and(...conditions)

    const [rows, [{ total }]] = await Promise.all([
      db.query.invoices.findMany({
        where,
        limit,
        offset,
        with: { project: { with: { client: true } } },
        orderBy: (t, { desc }) => [desc(t.createdAt)],
      }),
      db.select({ total: count() }).from(invoices).where(where),
    ])

    return c.json({ data: rows, meta: { page, limit, total } })
  },
)

invoicesRoutes.get('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const { id } = c.req.param()

  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.organizationId, orgId)),
    with: { project: { with: { client: true } } },
  })
  if (!invoice) throw new HttpError(404, 'Invoice not found')

  return c.json({ data: invoice })
})

invoicesRoutes.post('/', zValidator('json', invoiceSchema), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const body = c.req.valid('json')

  const invoiceNumber = await getNextInvoiceNumber(orgId)

  const [invoice] = await db
    .insert(invoices)
    .values({
      ...body,
      organizationId: orgId,
      invoiceNumber,
      createdBy: userId,
      lineItems: JSON.stringify(body.lineItems),
      dueDate: body.dueDate ? new Date(body.dueDate) : undefined,
      paidAt: body.paidAt ? new Date(body.paidAt) : undefined,
    })
    .returning()

  await createAuditLog({
    orgId, userId, action: 'invoice.created',
    resourceType: 'invoice', resourceId: invoice.id, after: invoice,
  })

  return c.json({ data: invoice }, 201)
})

invoicesRoutes.put('/:id', zValidator('json', invoiceSchema.partial()), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const { id } = c.req.param()
  const body = c.req.valid('json')

  const existing = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Invoice not found')
  if (existing.status === 'voided') throw new HttpError(400, 'Cannot edit a voided invoice')

  const updates: Record<string, unknown> = { ...body, updatedAt: new Date() }
  if (body.lineItems) updates.lineItems = JSON.stringify(body.lineItems)
  if (body.dueDate) updates.dueDate = new Date(body.dueDate)
  if (body.paidAt) updates.paidAt = new Date(body.paidAt)
  if (body.status === 'paid') {
    updates.paidAt = updates.paidAt ?? new Date()
    updates.amountDueCents = 0
  }

  const [updated] = await db
    .update(invoices)
    .set(updates as Partial<typeof invoices.$inferInsert>)
    .where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)))
    .returning()

  await createAuditLog({
    orgId, userId, action: 'invoice.updated',
    resourceType: 'invoice', resourceId: id, before: existing, after: updated,
  })

  return c.json({ data: updated })
})

invoicesRoutes.delete('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const role = c.get('role' as never) as string
  const { id } = c.req.param()

  if (role === 'employee') throw new HttpError(403, 'Employees cannot delete invoices')

  const existing = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.organizationId, orgId)),
  })
  if (!existing) throw new HttpError(404, 'Invoice not found')
  if (existing.status === 'paid') throw new HttpError(400, 'Cannot delete a paid invoice')

  await db.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.organizationId, orgId)))

  await createAuditLog({
    orgId, userId, action: 'invoice.deleted',
    resourceType: 'invoice', resourceId: id, before: existing,
  })

  return c.body(null, 204)
})

export { invoicesRoutes }
