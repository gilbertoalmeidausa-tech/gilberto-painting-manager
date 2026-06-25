import { db } from '../db'
import { auditLogs } from '../db/schema'

interface AuditParams {
  orgId: string
  userId: string | null
  action: string         // e.g. "client.created", "invoice.sent"
  resourceType: string   // e.g. "client", "invoice"
  resourceId?: string
  before?: unknown
  after?: unknown
  ipAddress?: string
}

export async function createAuditLog(params: AuditParams): Promise<void> {
  await db.insert(auditLogs).values({
    organizationId: params.orgId,
    userId: params.userId,
    action: params.action,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    diff: JSON.stringify({ before: params.before ?? null, after: params.after ?? null }),
    ipAddress: params.ipAddress,
  })
}
