import { prisma } from "@/lib/prisma"

const db = prisma as any

type LogAuditInput = {
  actorId?: string | null
  actorEmail?: string | null
  actorRole?: string | null
  targetUserId?: string | null
  action: string
  resource?: string | null
  resourceId?: string | null
  metadata?: unknown
  impersonationSessionId?: string | null
}

export async function logAudit(input: LogAuditInput) {
  try {
    await db.auditLog.create({
      data: {
        actorId: input.actorId || null,
        actorEmail: input.actorEmail || null,
        actorRole: input.actorRole || null,
        targetUserId: input.targetUserId || null,
        action: input.action,
        resource: input.resource || null,
        resourceId: input.resourceId || null,
        metadata:
          typeof input.metadata === "undefined"
            ? undefined
            : (input.metadata as Record<string, unknown>),
        impersonationSessionId: input.impersonationSessionId || null,
      },
    })
  } catch (err) {
    // Audit logging should never break core request flow.
    console.error("Audit log failed", err)
  }
}
