import { z } from 'zod'
import { roleSchema, planSchema } from './common'

export const registerSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(72),
  companyName: z.string().min(2).max(150),
})

export type RegisterInput = z.infer<typeof registerSchema>

export const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
})

export type LoginInput = z.infer<typeof loginSchema>

export const authUserSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().email(),
  orgId: z.string().uuid(),
  orgName: z.string(),
  role: roleSchema,
  plan: planSchema,
})

export type AuthUser = z.infer<typeof authUserSchema>

export interface JwtPayload {
  sub: string
  orgId: string
  role: string
  plan: string
  exp: number
  iat: number
}
