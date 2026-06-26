import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { secureHeaders } from 'hono/secure-headers'
import { readFile } from 'fs/promises'
import { existsSync, readFileSync } from 'fs'
import { join } from 'path'
import { env } from './env'
import { authRoutes } from './routes/auth'
import { clientsRoutes } from './routes/clients'
import { projectsRoutes } from './routes/projects'
import { proposalsRoutes } from './routes/proposals'
import { contractsRoutes } from './routes/contracts'
import { invoicesRoutes } from './routes/invoices'
import { photosRoutes } from './routes/photos'
import { teamRoutes } from './routes/team'
import { settingsRoutes } from './routes/settings'
import { auditRoutes } from './routes/audit'
import { billingRoutes } from './routes/billing'
import { errorHandler } from './lib/errors'
import { UPLOADS_DIR } from './lib/storage'

const app = new Hono()

// ─── Global middleware ────────────────────────────────────────────────────────
app.use('*', secureHeaders())
app.use(
  '*',
  cors({
    origin: env.CLIENT_URL,
    credentials: true,
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
)
app.use('*', logger())

// ─── Public: logo file serving (no auth) ─────────────────────────────────────
const MIME_MAP: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
  gif: 'image/gif', svg: 'image/svg+xml',
}

app.get('/api/public/logo/:orgId/:filename', async (c) => {
  const { orgId, filename } = c.req.param()
  const fullPath = join(UPLOADS_DIR, orgId, 'logo', filename)
  if (!existsSync(fullPath)) return c.json({ error: 'Not found' }, 404)
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const contentType = MIME_MAP[ext] ?? 'application/octet-stream'
  const data = await readFile(fullPath)
  return new Response(data, {
    headers: {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=86400',
    },
  })
})

// ─── Routes ──────────────────────────────────────────────────────────────────
app.route('/api/auth', authRoutes)
app.route('/api/clients', clientsRoutes)
app.route('/api/projects', projectsRoutes)
app.route('/api/proposals', proposalsRoutes)
app.route('/api/contracts', contractsRoutes)
app.route('/api/invoices', invoicesRoutes)
app.route('/api/photos', photosRoutes)
app.route('/api/team', teamRoutes)
app.route('/api/settings', settingsRoutes)
app.route('/api/audit', auditRoutes)
app.route('/api/billing', billingRoutes)

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (c) =>
  c.json({ status: 'ok', env: env.NODE_ENV, ts: Date.now() }),
)

// ─── Production: serve React SPA ─────────────────────────────────────────────
if (env.NODE_ENV === 'production') {
  // __dirname = /app/server/dist → ../../client/dist = /app/client/dist
  const clientDist = join(__dirname, '..', '..', 'client', 'dist')
  let indexHtml = ''
  try {
    indexHtml = readFileSync(join(clientDist, 'index.html'), 'utf-8')
  } catch { /* not built */ }
  app.use('/*', serveStatic({ root: clientDist }))
  app.get('/*', (c) => c.html(indexHtml))
}

// ─── 404 / Error handlers ─────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'Not found' }, 404))
app.onError(errorHandler)

// ─── Start ────────────────────────────────────────────────────────────────────
serve({ fetch: app.fetch, port: Number(env.PORT) }, ({ port }) =>
  console.log(`🚀  Server → http://localhost:${port}`),
)

export type AppType = typeof app
