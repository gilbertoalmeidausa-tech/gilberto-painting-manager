import Stripe from 'stripe'
import { env } from '../env'

export const stripe = env.STRIPE_SECRET_KEY
  ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: '2024-04-10' })
  : null

// Price ID map for Stripe checkout
export const STRIPE_PRICES: Record<string, string | undefined> = {
  basic_monthly:  env.STRIPE_PRICE_BASIC_MONTHLY,
  basic_yearly:   env.STRIPE_PRICE_BASIC_YEARLY,
  pro_monthly:    env.STRIPE_PRICE_PRO_MONTHLY,
  pro_yearly:     env.STRIPE_PRICE_PRO_YEARLY,
  team_monthly:   env.STRIPE_PRICE_TEAM_MONTHLY,
  team_yearly:    env.STRIPE_PRICE_TEAM_YEARLY,
}

export function getPriceId(plan: string, cycle: string): string | undefined {
  return STRIPE_PRICES[`${plan}_${cycle}`]
}
