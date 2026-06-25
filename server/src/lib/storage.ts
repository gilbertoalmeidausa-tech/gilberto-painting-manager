import { mkdir, writeFile, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { join, extname } from 'path'
import { randomUUID } from 'crypto'

export const UPLOADS_DIR = join(__dirname, '..', '..', 'uploads')

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'])

const LOGO_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const LOGO_ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/svg+xml'])

export interface SavedFile {
  filePath: string
  originalFilename: string
  mimeType: string
  fileSizeBytes: number
}

export async function saveUploadedFile(
  file: File,
  orgId: string,
  projectId: string,
): Promise<SavedFile> {
  if (!ALLOWED_TYPES.has(file.type)) {
    throw new Error(`File type not allowed: ${file.type}`)
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (max 10MB)`)
  }

  const dir = join(UPLOADS_DIR, orgId, projectId)
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const ext = extname(file.name) || '.jpg'
  const filename = `${randomUUID()}${ext}`
  const fullPath = join(dir, filename)
  const relativePath = `${orgId}/${projectId}/${filename}`

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(fullPath, buffer)

  return {
    filePath: relativePath,
    originalFilename: file.name,
    mimeType: file.type,
    fileSizeBytes: file.size,
  }
}

export async function saveLogoFile(
  file: File,
  orgId: string,
): Promise<string> {
  if (!LOGO_ALLOWED_TYPES.has(file.type)) {
    throw new Error(`File type not allowed: ${file.type}`)
  }
  if (file.size > LOGO_MAX_SIZE) {
    throw new Error(`File too large (max 5MB)`)
  }

  const dir = join(UPLOADS_DIR, orgId, 'logo')
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true })
  }

  const ext = extname(file.name) || '.png'
  const filename = `${randomUUID()}${ext}`
  const fullPath = join(dir, filename)

  const buffer = Buffer.from(await file.arrayBuffer())
  await writeFile(fullPath, buffer)

  // Returns short relative path: {orgId}/{uuid}.ext
  return `${orgId}/${filename}`
}

export async function deleteUploadedFile(filePath: string): Promise<void> {
  const fullPath = join(UPLOADS_DIR, filePath)
  await unlink(fullPath).catch(() => {})
}

// Logo paths in DB are "{orgId}/{filename}" but stored on disk under "{orgId}/logo/{filename}"
export async function deleteLogoFile(logoPath: string): Promise<void> {
  const [orgId, filename] = logoPath.split('/')
  const fullPath = join(UPLOADS_DIR, orgId, 'logo', filename)
  await unlink(fullPath).catch(() => {})
}

export function resolveFilePath(relativePath: string): string {
  return join(UPLOADS_DIR, relativePath)
}
