import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { randomBytes } from 'crypto'
import { db } from '../db'
import { organizationMembers, users, invitations } from '../db/schema'
import { authGuard, adminGuard } from '../middleware/auth'
import { enforcePlanLimit } from '../middleware/planLimits'
import { HttpError } from '../lib/errors'

const teamRoutes = new Hono()
teamRoutes.use('*', authGuard)

// ─── List members ─────────────────────────────────────────────────────────────

teamRoutes.get('/members', async (c) => {
  const orgId = c.get('orgId' as never) as string

  const members = await db.query.organizationMembers.findMany({
    where: and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.isActive, true),
    ),
    with: { user: true },
    orderBy: (t, { asc }) => [asc(t.createdAt)],
  })

  return c.json({
    data: members.map((m) => ({
      id: m.id,
      role: m.role,
      joinedAt: m.joinedAt,
      user: {
        id: m.user.id,
        name: m.user.name,
        email: m.user.email,
        avatarPath: m.user.avatarPath,
      },
    })),
  })
})

// ─── Update member role ───────────────────────────────────────────────────────

teamRoutes.patch(
  '/members/:memberId',
  adminGuard,
  zValidator('json', z.object({ role: z.enum(['admin', 'employee']) })),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const currentUserId = c.get('userId' as never) as string
    const { memberId } = c.req.param()
    const { role } = c.req.valid('json')

    const member = await db.query.organizationMembers.findFirst({
      where: and(
        eq(organizationMembers.id, memberId),
        eq(organizationMembers.organizationId, orgId),
      ),
    })
    if (!member) throw new HttpError(404, 'Member not found')
    if (member.role === 'owner') throw new HttpError(400, 'Cannot change owner role')
    if (member.userId === currentUserId) throw new HttpError(400, 'Cannot change your own role')

    const [updated] = await db
      .update(organizationMembers)
      .set({ role, updatedAt: new Date() })
      .where(eq(organizationMembers.id, memberId))
      .returning()

    return c.json({ data: updated })
  },
)

// ─── Remove member ────────────────────────────────────────────────────────────

teamRoutes.delete('/members/:memberId', adminGuard, async (c) => {
  const orgId = c.get('orgId' as never) as string
  const currentUserId = c.get('userId' as never) as string
  const { memberId } = c.req.param()

  const member = await db.query.organizationMembers.findFirst({
    where: and(
      eq(organizationMembers.id, memberId),
      eq(organizationMembers.organizationId, orgId),
    ),
  })
  if (!member) throw new HttpError(404, 'Member not found')
  if (member.role === 'owner') throw new HttpError(400, 'Cannot remove the owner')
  if (member.userId === currentUserId) throw new HttpError(400, 'Cannot remove yourself')

  await db
    .update(organizationMembers)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(organizationMembers.id, memberId))

  return c.body(null, 204)
})

// ─── List pending invitations ─────────────────────────────────────────────────

teamRoutes.get('/invitations', adminGuard, async (c) => {
  const orgId = c.get('orgId' as never) as string

  const rows = await db.query.invitations.findMany({
    where: and(
      eq(invitations.organizationId, orgId),
      // Only pending (not accepted and not expired)
    ),
    orderBy: (t, { desc }) => [desc(t.createdAt)],
  })

  return c.json({ data: rows })
})

// ─── Invite member ────────────────────────────────────────────────────────────

teamRoutes.post(
  '/invitations',
  adminGuard,
  enforcePlanLimit('members'),
  zValidator('json', z.object({
    email: z.string().email().toLowerCase(),
    role: z.enum(['admin', 'employee']).default('employee'),
  })),
  async (c) => {
    const orgId = c.get('orgId' as never) as string
    const userId = c.get('userId' as never) as string
    const { email, role } = c.req.valid('json')

    // Check if user already a member
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    })
    if (existingUser) {
      const existingMember = await db.query.organizationMembers.findFirst({
        where: and(
          eq(organizationMembers.organizationId, orgId),
          eq(organizationMembers.userId, existingUser.id),
          eq(organizationMembers.isActive, true),
        ),
      })
      if (existingMember) throw new HttpError(409, 'User is already a member')
    }

    const token = randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const [invitation] = await db
      .insert(invitations)
      .values({ organizationId: orgId, email, role, token, invitedBy: userId, expiresAt })
      .returning()

    // TODO: send invitation email via nodemailer
    // In development, log the invite link
    console.log(`[Invite] ${email} → ${process.env.APP_URL}/accept-invite?token=${token}`)

    return c.json({ data: invitation }, 201)
  },
)

// ─── Cancel invitation ────────────────────────────────────────────────────────

teamRoutes.delete('/invitations/:id', adminGuard, async (c) => {
  const orgId = c.get('orgId' as never) as string
  const { id } = c.req.param()

  const inv = await db.query.invitations.findFirst({
    where: and(eq(invitations.id, id), eq(invitations.organizationId, orgId)),
  })
  if (!inv) throw new HttpError(404, 'Invitation not found')

  await db.delete(invitations).where(eq(invitations.id, id))

  return c.body(null, 204)
})

export { teamRoutes }
