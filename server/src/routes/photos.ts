import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and, asc } from 'drizzle-orm'
import { z } from 'zod'
import { existsSync } from 'fs'
import { db } from '../db'
import { photos } from '../db/schema'
import { authGuard } from '../middleware/auth'
import { createAuditLog } from '../lib/audit'
import { HttpError } from '../lib/errors'
import { saveUploadedFile, deleteUploadedFile, resolveFilePath } from '../lib/storage'
import { readFile } from 'fs/promises'

const photosRoutes = new Hono()
photosRoutes.use('*', authGuard)

// ─── List photos for a project ───────────────────────────────────────────────

photosRoutes.get(
  '/',
  zValidator('query', z.object({ projectId: z.string().uuid() })),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const { projectId } = c.req.valid('query')

    const rows = await db.query.photos.findMany({
      where: and(eq(photos.organizationId, orgId), eq(photos.projectId, projectId)),
      orderBy: [asc(photos.phase), asc(photos.sortOrder), asc(photos.createdAt)],
    })

    return c.json({ data: rows })
  },
)

// ─── Upload ───────────────────────────────────────────────────────────────────

photosRoutes.post('/', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string

  const formData = await c.req.formData()
  const file = formData.get('file') as File | null
  const projectId = formData.get('projectId') as string | null
  const phase = (formData.get('phase') as string) || 'before'
  const caption = (formData.get('caption') as string) || ''

  if (!file || !(file instanceof File)) {
    throw new HttpError(400, 'No file provided')
  }
  if (!projectId) {
    throw new HttpError(400, 'projectId is required')
  }

  const validPhases = ['before', 'during', 'after', 'completed']
  if (!validPhases.includes(phase)) {
    throw new HttpError(400, 'Invalid phase')
  }

  const saved = await saveUploadedFile(file, orgId, projectId).catch((err) => {
    throw new HttpError(400, err.message)
  })

  const [photo] = await db
    .insert(photos)
    .values({
      organizationId: orgId,
      projectId,
      filePath: saved.filePath,
      originalFilename: saved.originalFilename,
      mimeType: saved.mimeType,
      fileSizeBytes: saved.fileSizeBytes,
      caption: caption || null,
      phase: phase as 'before' | 'during' | 'after' | 'completed',
      uploadedBy: userId,
    })
    .returning()

  await createAuditLog({
    orgId, userId, action: 'photo.uploaded',
    resourceType: 'photo', resourceId: photo.id, after: photo,
  })

  return c.json({ data: photo }, 201)
})

// ─── Update caption / phase ───────────────────────────────────────────────────

photosRoutes.patch(
  '/:id',
  zValidator('json', z.object({
    caption: z.string().optional(),
    phase: z.enum(['before', 'during', 'after', 'completed']).optional(),
    sortOrder: z.number().int().optional(),
  })),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const { id } = c.req.param()
    const body = c.req.valid('json')

    const photo = await db.query.photos.findFirst({
      where: and(eq(photos.id, id), eq(photos.organizationId, orgId)),
    })
    if (!photo) throw new HttpError(404, 'Photo not found')

    const [updated] = await db
      .update(photos)
      .set(body)
      .where(and(eq(photos.id, id), eq(photos.organizationId, orgId)))
      .returning()

    return c.json({ data: updated })
  },
)

// ─── Delete ───────────────────────────────────────────────────────────────────

photosRoutes.delete('/:id', async (c) => {
  const orgId = c.get('orgId' as never) as string
  const userId = c.get('userId' as never) as string
  const { id } = c.req.param()

  const photo = await db.query.photos.findFirst({
    where: and(eq(photos.id, id), eq(photos.organizationId, orgId)),
  })
  if (!photo) throw new HttpError(404, 'Photo not found')

  await db.delete(photos).where(and(eq(photos.id, id), eq(photos.organizationId, orgId)))
  await deleteUploadedFile(photo.filePath)

  await createAuditLog({
    orgId, userId, action: 'photo.deleted',
    resourceType: 'photo', resourceId: id, before: photo,
  })

  return c.body(null, 204)
})

// ─── Serve file ───────────────────────────────────────────────────────────────

photosRoutes.get('/file/:orgId/:projectId/:filename', async (c) => {
  const tokenOrgId = c.get('orgId' as never) as string
  const { orgId, projectId, filename } = c.req.param()

  // Users can only access their own org's files
  if (orgId !== tokenOrgId) throw new HttpError(403, 'Forbidden')

  const relativePath = `${orgId}/${projectId}/${filename}`
  const fullPath = resolveFilePath(relativePath)

  if (!existsSync(fullPath)) {
    throw new HttpError(404, 'File not found')
  }

  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const mimeMap: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg',
    png: 'image/png', webp: 'image/webp',
    gif: 'image/gif', heic: 'image/heic', heif: 'image/heif',
  }
  const contentType = mimeMap[ext] ?? 'application/octet-stream'

  const fileData = await readFile(fullPath)
  return c.body(fileData, 200, { 'Content-Type': contentType, 'Cache-Control': 'private, max-age=3600' })
})

export { photosRoutes }
