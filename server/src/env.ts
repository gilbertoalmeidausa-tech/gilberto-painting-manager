import { config } from 'dotenv'
import { resolve } from 'path'
import { z } from 'zod'

config({ path: resolve(__dirname, '../../.env'), override: false })

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  TRIAL_DAYS: z.coerce.number().int().min(1).default(14),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_PRICE_BASIC_MONTHLY: z.string().optional(),
  STRIPE_PRICE_BASIC_YEARLY: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_YEARLY: z.string().optional(),
  STRIPE_PRICE_TEAM_MONTHLY: z.string().optional(),
  STRIPE_PRICE_TEAM_YEARLY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('noreply@gilbertopropainting.com'),
})

const result = envSchema.safeParse(process.env)

if (!result.success) {
  console.error('❌  Invalid environment variables:')
  console.error(result.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = result.data
