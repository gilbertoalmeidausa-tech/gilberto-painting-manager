import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { organizationSettings } from '../db/schema'
import { authGuard, adminGuard } from '../middleware/auth'
import { HttpError } from '../lib/errors'
import { saveLogoFile, deleteLogoFile } from '../lib/storage'

const settingsRoutes = new Hono()
settingsRoutes.use('*', authGuard)

const settingsSchema = z.object({
  companyName: z.string().max(150).optional(),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  website: z.string().max(255).optional(),
  address: z.string().max(255).optional(),
  city: z.string().max(100).optional(),
  state: z.string().max(100).optional(),
  zip: z.string().max(20).optional(),
  defaultTaxRateCents: z.number().int().min(0).max(10000).optional(),
  defaultPaymentTerms: z.string().optional(),
  defaultTermsAndConditions: z.string().optional(),
  invoicePrefix: z.string().max(10).optional(),
  proposalPrefix: z.string().max(10).optional(),
  contractPrefix: z.string().max(10).optional(),
})

// ─── GET /api/settings ────────────────────────────────────────────────────────

settingsRoutes.get('/', async (c) => {
  const orgId = c.get('orgId' as never) as string

  const settings = await db.query.organizationSettings.findFirst({
    where: eq(organizationSettings.organizationId, orgId),
  })
  if (!settings) throw new HttpError(404, 'Settings not found')

  return c.json({ data: settings })
})

// ─── PATCH /api/settings ──────────────────────────────────────────────────────

settingsRoutes.patch('/', adminGuard, zValidator('json', settingsSchema), async (c) => {
  const orgId = c.get('orgId' as never) as string
  const body = c.req.valid('json')

  const existing = await db.query.organizationSettings.findFirst({
    where: eq(organizationSettings.organizationId, orgId),
  })
  if (!existing) throw new HttpError(404, 'Settings not found')

  const [updated] = await db
    .update(organizationSettings)
    .set({ ...body, updatedAt: new Date() })
    .where(eq(organizationSettings.organizationId, orgId))
    .returning()

  return c.json({ data: updated })
})

// ─── POST /api/settings/logo ──────────────────────────────────────────────────

settingsRoutes.post('/logo', adminGuard, async (c) => {
  const orgId = c.get('orgId' as never) as string

  const formData = await c.req.formData()
  const file = formData.get('file')
  if (!file || !(file instanceof File)) throw new HttpError(400, 'No file provided')

  const existing = await db.query.organizationSettings.findFirst({
    where: eq(organizationSettings.organizationId, orgId),
  })
  if (!existing) throw new HttpError(404, 'Settings not found')

  if (existing.logoPath) {
    await deleteLogoFile(existing.logoPath)
  }

  const relativePath = await saveLogoFile(file, orgId)

  const [updated] = await db
    .update(organizationSettings)
    .set({ logoPath: relativePath, updatedAt: new Date() })
    .where(eq(organizationSettings.organizationId, orgId))
    .returning()

  return c.json({ data: updated })
})

// ─── DELETE /api/settings/logo ────────────────────────────────────────────────

settingsRoutes.delete('/logo', adminGuard, async (c) => {
  const orgId = c.get('orgId' as never) as string

  const existing = await db.query.organizationSettings.findFirst({
    where: eq(organizationSettings.organizationId, orgId),
  })
  if (!existing) throw new HttpError(404, 'Settings not found')

  if (existing.logoPath) {
    await deleteLogoFile(existing.logoPath)
  }

  const [updated] = await db
    .update(organizationSettings)
    .set({ logoPath: null, updatedAt: new Date() })
    .where(eq(organizationSettings.organizationId, orgId))
    .returning()

  return c.json({ data: updated })
})

export { settingsRoutes }
