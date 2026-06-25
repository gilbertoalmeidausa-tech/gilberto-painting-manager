import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { db } from '../db'
import {
  users,
  organizations,
  organizationMembers,
  organizationSettings,
} from '../db/schema'
import {
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_COOKIE_OPTIONS,
} from '../lib/auth'
import { authGuard } from '../middleware/auth'
import { registerSchema, loginSchema } from '@painting/shared'
import { generateSlug } from '../lib/slug'
import { env } from '../env'
import { getCookie, setCookie, deleteCookie } from 'hono/cookie'

const authRoutes = new Hono()

// ─── Register ─────────────────────────────────────────────────────────────────

authRoutes.post('/register', zValidator('json', registerSchema), async (c) => {
  const { name, email, password, companyName } = c.req.valid('json')

  // Check if email already exists — but always return same error to prevent user enumeration
  const existing = await db.query.users.findFirst({
    where: eq(users.email, email),
  })
  if (existing) {
    return c.json({ error: 'Registration failed. Please try again.' }, 400)
  }

  const passwordHash = await hashPassword(password)
  const trialEndsAt = new Date(Date.now() + env.TRIAL_DAYS * 24 * 60 * 60 * 1000)

  // Create slug — ensure uniqueness
  let slug = generateSlug(companyName)
  const slugExists = await db.query.organizations.findFirst({
    where: eq(organizations.slug, slug),
  })
  if (slugExists) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`
  }

  // All in one transaction
  const result = await db.transaction(async (tx) => {
    const [user] = await tx
      .insert(users)
      .values({ name, email, passwordHash })
      .returning()

    const [org] = await tx
      .insert(organizations)
      .values({
        name: companyName,
        slug,
        plan: 'free_trial',
        planStatus: 'trialing',
        trialEndsAt,
      })
      .returning()

    await tx.insert(organizationMembers).values({
      organizationId: org.id,
      userId: user.id,
      role: 'owner',
    })

    await tx.insert(organizationSettings).values({
      organizationId: org.id,
      companyName,
    })

    return { user, org }
  })

  const { user, org } = result

  const tokenPayload = { sub: user.id, orgId: org.id, role: 'owner', plan: 'free_trial' }
  const accessToken = await signAccessToken(tokenPayload)
  const refreshToken = await signRefreshToken(tokenPayload)

  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db
    .update(users)
    .set({ refreshToken, refreshTokenExpiresAt: refreshExpiry })
    .where(eq(users.id, user.id))

  setCookie(c, 'refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS)

  return c.json({
    data: {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        orgId: org.id,
        orgName: org.name,
        role: 'owner',
        plan: 'free_trial' as const,
      },
    },
  }, 201)
})

// ─── Login ────────────────────────────────────────────────────────────────────

authRoutes.post('/login', zValidator('json', loginSchema), async (c) => {
  const { email, password } = c.req.valid('json')

  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  // Constant-time-ish: always run bcrypt to prevent timing attacks
  const passwordHash = user?.passwordHash ?? '$2a$12$invalidhashpaddingtomakeitlook'
  const valid = await verifyPassword(password, passwordHash)

  if (!user || !valid) {
    return c.json({ error: 'Invalid email or password' }, 401)
  }

  // Get the user's membership (they could belong to multiple orgs — get most recent)
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, user.id),
      eq(organizationMembers.isActive, true),
    ),
    with: { organization: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  if (!membership) {
    return c.json({ error: 'No organization found for this account' }, 403)
  }

  const { organization: org } = membership

  const tokenPayload = {
    sub: user.id,
    orgId: org.id,
    role: membership.role,
    plan: org.plan,
  }
  const accessToken = await signAccessToken(tokenPayload)
  const refreshToken = await signRefreshToken(tokenPayload)

  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db
    .update(users)
    .set({ refreshToken, refreshTokenExpiresAt: refreshExpiry })
    .where(eq(users.id, user.id))

  setCookie(c, 'refresh_token', refreshToken, REFRESH_COOKIE_OPTIONS)

  return c.json({
    data: {
      accessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        orgId: org.id,
        orgName: org.name,
        role: membership.role,
        plan: org.plan,
      },
    },
  })
})

// ─── Refresh ──────────────────────────────────────────────────────────────────

authRoutes.post('/refresh', async (c) => {
  const token = getCookie(c, 'refresh_token')
  if (!token) return c.json({ error: 'Unauthorized' }, 401)

  let payload
  try {
    payload = await verifyRefreshToken(token)
  } catch {
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Validate rotation: token must match the stored one
  const user = await db.query.users.findFirst({
    where: eq(users.id, payload.sub),
  })

  if (!user || user.refreshToken !== token) {
    // Token reuse detected — invalidate all sessions
    if (user) {
      await db
        .update(users)
        .set({ refreshToken: null, refreshTokenExpiresAt: null })
        .where(eq(users.id, user.id))
    }
    deleteCookie(c, 'refresh_token', { path: '/' })
    return c.json({ error: 'Unauthorized' }, 401)
  }

  // Get updated membership (plan might have changed since last login)
  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, user.id),
      eq(organizationMembers.isActive, true),
    ),
    with: { organization: true },
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  if (!membership) return c.json({ error: 'Unauthorized' }, 401)

  const { organization: org } = membership
  const tokenPayload = {
    sub: user.id,
    orgId: org.id,
    role: membership.role,
    plan: org.plan,
  }

  const newAccessToken = await signAccessToken(tokenPayload)
  const newRefreshToken = await signRefreshToken(tokenPayload)

  const refreshExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  await db
    .update(users)
    .set({ refreshToken: newRefreshToken, refreshTokenExpiresAt: refreshExpiry })
    .where(eq(users.id, user.id))

  setCookie(c, 'refresh_token', newRefreshToken, REFRESH_COOKIE_OPTIONS)

  return c.json({
    data: {
      accessToken: newAccessToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        orgId: org.id,
        orgName: org.name,
        role: membership.role,
        plan: org.plan,
      },
    },
  })
})

// ─── Logout ───────────────────────────────────────────────────────────────────

authRoutes.post('/logout', async (c) => {
  const token = getCookie(c, 'refresh_token')
  if (token) {
    // Invalidate the stored token
    const payload = await verifyRefreshToken(token).catch(() => null)
    if (payload) {
      await db
        .update(users)
        .set({ refreshToken: null, refreshTokenExpiresAt: null })
        .where(eq(users.id, payload.sub))
        .catch(() => {}) // best-effort
    }
  }
  deleteCookie(c, 'refresh_token', { path: '/' })
  return c.json({ data: { success: true } })
})

// ─── Me ───────────────────────────────────────────────────────────────────────

authRoutes.get('/me', authGuard, async (c) => {
  const userId = c.get('userId' as never) as string
  const orgId = c.get('orgId' as never) as string

  const membership = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.userId, userId),
      eq(organizationMembers.organizationId, orgId),
    ),
    with: {
      user: true,
      organization: true,
    },
  })

  if (!membership) return c.json({ error: 'Not found' }, 404)

  const { user, organization: org } = membership

  return c.json({
    data: {
      id: user.id,
      name: user.name,
      email: user.email,
      orgId: org.id,
      orgName: org.name,
      role: membership.role,
      plan: org.plan,
      planStatus: org.planStatus,
      trialEndsAt: org.trialEndsAt,
    },
  })
})

export { authRoutes }
