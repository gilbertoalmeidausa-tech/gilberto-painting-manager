import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export type PaginationInput = z.infer<typeof paginationSchema>

export interface PaginatedMeta {
  page: number
  limit: number
  total: number
}

export interface ApiResponse<T> {
  data: T
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: PaginatedMeta
}

export interface ApiError {
  error: string
}

export const planSchema = z.enum(['free_trial', 'basic', 'pro', 'team'])
export type Plan = z.infer<typeof planSchema>

export const planStatusSchema = z.enum(['trialing', 'active', 'past_due', 'canceled', 'paused'])
export type PlanStatus = z.infer<typeof planStatusSchema>

export const roleSchema = z.enum(['owner', 'admin', 'employee'])
export type Role = z.infer<typeof roleSchema>

export const PLAN_LIMITS = {
  free_trial: { maxClients: 3, maxProjects: 5, maxMembers: 1, maxStorageMb: 100 },
  basic:      { maxClients: null, maxProjects: null, maxMembers: 1, maxStorageMb: 1024 },
  pro:        { maxClients: null, maxProjects: null, maxMembers: 5, maxStorageMb: 5120 },
  team:       { maxClients: null, maxProjects: null, maxMembers: null, maxStorageMb: 20480 },
} as const satisfies Record<Plan, { maxClients: number | null; maxProjects: number | null; maxMembers: number | null; maxStorageMb: number }>
