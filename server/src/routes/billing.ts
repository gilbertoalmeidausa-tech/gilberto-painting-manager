import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../db'
import { organizations } from '../db/schema'
import { authGuard, ownerGuard } from '../middleware/auth'
import { stripe, getPriceId } from '../lib/stripe'
import { HttpError } from '../lib/errors'
import { env } from '../env'
import type Stripe from 'stripe'

const billingRoutes = new Hono()

// Public plan info (no auth needed)
billingRoutes.get('/plans', (c) => {
  return c.json({
    data: [
      {
        id: 'free_trial',
        name: 'Free Trial',
        description: '14 days free, no credit card required',
        priceMonthlyCents: 0,
        priceYearlyCents: 0,
        maxClients: 3,
        maxProjects: 5,
        maxMembers: 1,
        maxStorageMb: 100,
        features: ['PDF generation', 'Basic dashboard'],
      },
      {
        id: 'basic',
        name: 'Basic',
        description: 'For solo contractors',
        priceMonthlyCents: 2900,
        priceYearlyCents: 29000,
        maxClients: null,
        maxProjects: null,
        maxMembers: 1,
        maxStorageMb: 1024,
        features: ['Unlimited clients & projects', 'PDF generation', '1GB photo storage'],
      },
      {
        id: 'pro',
        name: 'Pro',
        description: 'For growing teams',
        priceMonthlyCents: 5900,
        priceYearlyCents: 59000,
        maxClients: null,
        maxProjects: null,
        maxMembers: 5,
        maxStorageMb: 5120,
        features: ['Up to 5 team members', 'Audit logs', '5GB photo storage'],
      },
      {
        id: 'team',
        name: 'Team',
        description: 'For large crews',
        priceMonthlyCents: 9900,
        priceYearlyCents: 99000,
        maxClients: null,
        maxProjects: null,
        maxMembers: null,
        maxStorageMb: 20480,
        features: ['Unlimited team members', 'Advanced permissions', '20GB photo storage'],
      },
    ],
  })
})

// All billing mutations require auth + owner role
billingRoutes.use('/checkout', authGuard, ownerGuard)
billingRoutes.use('/portal', authGuard, ownerGuard)
billingRoutes.use('/subscription', authGuard)

billingRoutes.get('/subscription', async (c) => {
  const orgId = c.get('orgId' as never) as string

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org) throw new HttpError(404, 'Organization not found')

  return c.json({
    data: {
      plan: org.plan,
      planStatus: org.planStatus,
      billingCycle: org.billingCycle,
      trialEndsAt: org.trialEndsAt,
      currentPeriodEndsAt: org.currentPeriodEndsAt,
      stripeSubscriptionId: org.stripeSubscriptionId,
    },
  })
})

billingRoutes.post(
  '/checkout',
  zValidator('json', z.object({
    plan: z.enum(['basic', 'pro', 'team']),
    cycle: z.enum(['monthly', 'yearly']),
  })),
  async (c) => {
    if (!stripe) throw new HttpError(503, 'Billing is not configured')

    const orgId = c.get('orgId' as never) as string
    const userId = c.get('userId' as never) as string
    const { plan, cycle } = c.req.valid('json')

    const priceId = getPriceId(plan, cycle)
    if (!priceId) throw new HttpError(400, `Price not configured for ${plan}/${cycle}`)

    const org = await db.query.organizations.findFirst({
      where: eq(organizations.id, orgId),
    })
    if (!org) throw new HttpError(404, 'Organization not found')

    // Create or retrieve Stripe customer
    let customerId = org.stripeCustomerId
    if (!customerId) {
      const customer = await stripe.customers.create({
        metadata: { orgId, userId },
      })
      customerId = customer.id
      await db
        .update(organizations)
        .set({ stripeCustomerId: customerId })
        .where(eq(organizations.id, orgId))
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${env.APP_URL}/billing?success=true`,
      cancel_url: `${env.APP_URL}/billing?canceled=true`,
      metadata: { orgId, plan, cycle },
      subscription_data: {
        metadata: { orgId, plan, cycle },
      },
      allow_promotion_codes: true,
    })

    return c.json({ data: { url: session.url } })
  },
)

billingRoutes.post('/portal', async (c) => {
  if (!stripe) throw new HttpError(503, 'Billing is not configured')

  const orgId = c.get('orgId' as never) as string

  const org = await db.query.organizations.findFirst({
    where: eq(organizations.id, orgId),
  })
  if (!org?.stripeCustomerId) throw new HttpError(400, 'No active subscription')

  const session = await stripe.billingPortal.sessions.create({
    customer: org.stripeCustomerId,
    return_url: `${env.APP_URL}/billing`,
  })

  return c.json({ data: { url: session.url } })
})

// ─── Webhook (no auth — signature verified) ──────────────────────────────────

billingRoutes.post('/webhook', async (c) => {
  if (!stripe || !env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Webhook not configured' }, 503)
  }

  const signature = c.req.header('stripe-signature')
  if (!signature) return c.json({ error: 'Missing signature' }, 400)

  const body = await c.req.text()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, signature, env.STRIPE_WEBHOOK_SECRET)
  } catch {
    return c.json({ error: 'Invalid signature' }, 400)
  }

  try {
    await handleStripeEvent(event)
  } catch (err) {
    console.error('[Stripe webhook error]', err)
    return c.json({ error: 'Webhook handler failed' }, 500)
  }

  return c.json({ received: true })
})

async function handleStripeEvent(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const { orgId, plan, cycle } = session.metadata ?? {}
      if (!orgId || !plan || !cycle) return

      await db
        .update(organizations)
        .set({
          plan: plan as 'basic' | 'pro' | 'team',
          planStatus: 'active',
          billingCycle: cycle as 'monthly' | 'yearly',
          stripeSubscriptionId: session.subscription as string,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, orgId))
      break
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription
      const { orgId } = sub.metadata ?? {}
      if (!orgId) return

      const plan = sub.metadata?.plan as string | undefined
      const cycle = sub.metadata?.cycle as string | undefined

      await db
        .update(organizations)
        .set({
          planStatus: sub.status as 'active' | 'past_due' | 'canceled' | 'paused',
          ...(plan ? { plan: plan as 'basic' | 'pro' | 'team' } : {}),
          ...(cycle ? { billingCycle: cycle as 'monthly' | 'yearly' } : {}),
          currentPeriodEndsAt: new Date(sub.current_period_end * 1000),
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, orgId))
      break
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      const { orgId } = sub.metadata ?? {}
      if (!orgId) return

      await db
        .update(organizations)
        .set({
          plan: 'free_trial',
          planStatus: 'canceled',
          stripeSubscriptionId: null,
          updatedAt: new Date(),
        })
        .where(eq(organizations.id, orgId))
      break
    }

    case 'invoice.payment_succeeded': {
      const inv = event.data.object as Stripe.Invoice
      const customerId = inv.customer as string

      const org = await db.query.organizations.findFirst({
        where: eq(organizations.stripeCustomerId, customerId),
      })
      if (!org) return

      const sub = inv.subscription
        ? await stripe!.subscriptions.retrieve(inv.subscription as string)
        : null

      if (sub) {
        await db
          .update(organizations)
          .set({
            planStatus: 'active',
            currentPeriodEndsAt: new Date(sub.current_period_end * 1000),
            updatedAt: new Date(),
          })
          .where(eq(organizations.id, org.id))
      }
      break
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice
      const customerId = inv.customer as string

      await db
        .update(organizations)
        .set({ planStatus: 'past_due', updatedAt: new Date() })
        .where(eq(organizations.stripeCustomerId, customerId))
      break
    }
  }
}

export { billingRoutes }
