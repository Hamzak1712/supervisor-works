import { NextResponse } from "next/server"
import { signToken, verifyTokenFromHeader } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import {
  ensureRbacSeed,
  hasPermission,
  listPermissionCatalog,
} from "@/lib/rbac"
import { logAudit } from "@/lib/audit"

const db = prisma as any

type GovernancePayload = {
  permissions: Array<{
    id: string
    key: string
    name: string
    category: string
    description: string | null
  }>
  roles: Array<{
    id: string
    slug: string
    name: string
    description: string | null
    isSystem: boolean
    baseRole: "STUDENT" | "SUPERVISOR" | "ADMIN" | null
    permissions: string[]
    assignedUsersCount: number
  }>
  assignments: Array<{
    id: string
    userId: string
    userEmail: string
    roleId: string
    roleSlug: string
    roleName: string
    createdAt: Date
    assignedByEmail: string | null
  }>
  users: Array<{
    id: string
    email: string
    role: "STUDENT" | "SUPERVISOR" | "ADMIN"
    status: "ACTIVE" | "SUSPENDED" | "PENDING"
  }>
  auditLogs: Array<{
    id: string
    actorEmail: string | null
    actorRole: string | null
    targetUserId: string | null
    action: string
    resource: string | null
    resourceId: string | null
    metadata: unknown
    createdAt: Date
  }>
}

function normalizeSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
}

async function getGovernancePayload(): Promise<GovernancePayload> {
  await ensureRbacSeed()

  const permissions = await listPermissionCatalog()

  const [roles, assignments, users, auditLogs] = (await Promise.all([
    db.customRole.findMany({
      orderBy: [{ isSystem: "desc" }, { name: "asc" }],
      select: {
        id: true,
        slug: true,
        name: true,
        description: true,
        isSystem: true,
        baseRole: true,
        permissions: {
          where: {
            granted: true,
          },
          select: {
            permission: {
              select: {
                key: true,
              },
            },
          },
        },
        _count: {
          select: {
            assignments: true,
          },
        },
      },
    }),
    db.userCustomRole.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        userId: true,
        roleId: true,
        createdAt: true,
        user: {
          select: {
            email: true,
          },
        },
        role: {
          select: {
            slug: true,
            name: true,
          },
        },
        assignedBy: {
          select: {
            email: true,
          },
        },
      },
    }),
    db.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
      },
    }),
    db.auditLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 80,
      select: {
        id: true,
        actorEmail: true,
        actorRole: true,
        targetUserId: true,
        action: true,
        resource: true,
        resourceId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ])) as [
    Array<{
      id: string
      slug: string
      name: string
      description: string | null
      isSystem: boolean
      baseRole: "STUDENT" | "SUPERVISOR" | "ADMIN" | null
      permissions: Array<{
        permission: {
          key: string
        }
      }>
      _count: {
        assignments: number
      }
    }>,
    Array<{
      id: string
      userId: string
      roleId: string
      createdAt: Date
      user: {
        email: string
      }
      role: {
        slug: string
        name: string
      }
      assignedBy: {
        email: string
      } | null
    }>,
    Array<{
      id: string
      email: string
      role: "STUDENT" | "SUPERVISOR" | "ADMIN"
      status: "ACTIVE" | "SUSPENDED" | "PENDING"
    }>,
    Array<{
      id: string
      actorEmail: string | null
      actorRole: string | null
      targetUserId: string | null
      action: string
      resource: string | null
      resourceId: string | null
      metadata: unknown
      createdAt: Date
    }>,
  ]

  return {
    permissions,
    roles: roles.map((role) => ({
      id: role.id,
      slug: role.slug,
      name: role.name,
      description: role.description,
      isSystem: role.isSystem,
      baseRole: role.baseRole,
      permissions: role.permissions.map((item) => item.permission.key),
      assignedUsersCount: role._count.assignments,
    })),
    assignments: assignments.map((assignment) => ({
      id: assignment.id,
      userId: assignment.userId,
      userEmail: assignment.user.email,
      roleId: assignment.roleId,
      roleSlug: assignment.role.slug,
      roleName: assignment.role.name,
      createdAt: assignment.createdAt,
      assignedByEmail: assignment.assignedBy?.email || null,
    })),
    users,
    auditLogs,
  }
}

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), {
      path: new URL(req.url).pathname,
      method: req.method,
    })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const allowed = await hasPermission(payload, "admin.rbac.manage")
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = await getGovernancePayload()
    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), {
      path: new URL(req.url).pathname,
      method: req.method,
    })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.trim() : ""
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    if (action === "stop_impersonation") {
      if (!payload.isImpersonating || !payload.actorSub) {
        return NextResponse.json(
          { error: "Not currently impersonating a user" },
          { status: 400 }
        )
      }

      const actorUser = await prisma.user.findUnique({
        where: { id: payload.actorSub },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          sessionVersion: true,
        },
      })

      if (!actorUser || actorUser.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Original admin account is unavailable" },
          { status: 400 }
        )
      }

      if (payload.impersonationSessionId) {
        await db.impersonationSession.updateMany({
          where: {
            id: payload.impersonationSessionId,
            endedAt: null,
          },
          data: {
            endedAt: new Date(),
          },
        })
      }

      await logAudit({
        actorId: payload.actorSub,
        actorEmail: payload.actorEmail,
        actorRole: payload.actorRole,
        targetUserId: payload.sub,
        action: "impersonation_stopped",
        resource: "auth",
        metadata: {
          via: "admin_rbac",
        },
        impersonationSessionId: payload.impersonationSessionId || null,
      })

      const token = await signToken({
        sub: actorUser.id,
        email: actorUser.email,
        role: actorUser.role,
        sessionVersion: actorUser.sessionVersion,
      })

      return NextResponse.json(
        {
          token,
          user: {
            id: actorUser.id,
            email: actorUser.email,
            role: actorUser.role,
          },
        },
        { status: 200 }
      )
    }

    const allowed = await hasPermission(payload, "admin.rbac.manage")
    if (!allowed) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (action === "create_role") {
      const name = typeof body.name === "string" ? body.name.trim() : ""
      const slugRaw = typeof body.slug === "string" ? body.slug.trim() : ""
      const description =
        typeof body.description === "string" ? body.description.trim() : ""

      if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 })
      }

      const slug = normalizeSlug(slugRaw || name)
      if (!slug) {
        return NextResponse.json(
          { error: "role slug is invalid" },
          { status: 400 }
        )
      }

      const existing = await db.customRole.findUnique({
        where: { slug },
        select: { id: true },
      })

      if (existing) {
        return NextResponse.json(
          { error: "role slug already exists" },
          { status: 409 }
        )
      }

      await db.customRole.create({
        data: {
          slug,
          name,
          description: description || null,
          isSystem: false,
          createdById: payload.sub,
        },
      })

      await logAudit({
        actorId: payload.sub,
        actorEmail: payload.email,
        actorRole: payload.role,
        action: "role_created",
        resource: "custom_role",
        resourceId: slug,
      })

      const data = await getGovernancePayload()
      return NextResponse.json(data, { status: 200 })
    }

    if (action === "set_role_permission") {
      const roleId = typeof body.roleId === "string" ? body.roleId.trim() : ""
      const permissionKey =
        typeof body.permissionKey === "string" ? body.permissionKey.trim() : ""
      const granted = body.granted === true

      if (!roleId || !permissionKey) {
        return NextResponse.json(
          { error: "roleId and permissionKey are required" },
          { status: 400 }
        )
      }

      const [roleRow, permissionRow] = (await Promise.all([
        db.customRole.findUnique({
          where: { id: roleId },
          select: { id: true, slug: true, isSystem: true },
        }),
        db.permission.findUnique({
          where: { key: permissionKey },
          select: { id: true, key: true },
        }),
      ])) as [
        { id: string; slug: string; isSystem: boolean } | null,
        { id: string; key: string } | null,
      ]

      if (!roleRow || !permissionRow) {
        return NextResponse.json(
          { error: "Role or permission not found" },
          { status: 404 }
        )
      }

      if (roleRow.slug === "admin" && !granted) {
        return NextResponse.json(
          { error: "Cannot revoke permissions from system admin role." },
          { status: 400 }
        )
      }

      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRow.id,
            permissionId: permissionRow.id,
          },
        },
        update: {
          granted,
        },
        create: {
          roleId: roleRow.id,
          permissionId: permissionRow.id,
          granted,
        },
      })

      await logAudit({
        actorId: payload.sub,
        actorEmail: payload.email,
        actorRole: payload.role,
        action: granted ? "permission_granted" : "permission_revoked",
        resource: "custom_role",
        resourceId: roleRow.id,
        metadata: {
          permissionKey,
        },
      })

      const data = await getGovernancePayload()
      return NextResponse.json(data, { status: 200 })
    }

    if (action === "assign_role") {
      const userId = typeof body.userId === "string" ? body.userId.trim() : ""
      const roleId = typeof body.roleId === "string" ? body.roleId.trim() : ""

      if (!userId || !roleId) {
        return NextResponse.json(
          { error: "userId and roleId are required" },
          { status: 400 }
        )
      }

      await db.userCustomRole.upsert({
        where: {
          userId_roleId: {
            userId,
            roleId,
          },
        },
        update: {
          assignedById: payload.sub,
        },
        create: {
          userId,
          roleId,
          assignedById: payload.sub,
        },
      })

      await logAudit({
        actorId: payload.sub,
        actorEmail: payload.email,
        actorRole: payload.role,
        targetUserId: userId,
        action: "role_assigned",
        resource: "custom_role",
        resourceId: roleId,
      })

      const data = await getGovernancePayload()
      return NextResponse.json(data, { status: 200 })
    }

    if (action === "revoke_role") {
      const userId = typeof body.userId === "string" ? body.userId.trim() : ""
      const roleId = typeof body.roleId === "string" ? body.roleId.trim() : ""

      if (!userId || !roleId) {
        return NextResponse.json(
          { error: "userId and roleId are required" },
          { status: 400 }
        )
      }

      await db.userCustomRole.deleteMany({
        where: {
          userId,
          roleId,
        },
      })

      await logAudit({
        actorId: payload.sub,
        actorEmail: payload.email,
        actorRole: payload.role,
        targetUserId: userId,
        action: "role_revoked",
        resource: "custom_role",
        resourceId: roleId,
      })

      const data = await getGovernancePayload()
      return NextResponse.json(data, { status: 200 })
    }

    if (action === "impersonate_user") {
      const canImpersonate = await hasPermission(payload, "admin.impersonation.use")
      if (!canImpersonate) {
        return NextResponse.json(
          { error: "You do not have impersonation permission." },
          { status: 403 }
        )
      }

      const targetUserId =
        typeof body.targetUserId === "string" ? body.targetUserId.trim() : ""
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""

      if (!targetUserId) {
        return NextResponse.json(
          { error: "targetUserId is required" },
          { status: 400 }
        )
      }

      if (targetUserId === payload.sub) {
        return NextResponse.json(
          { error: "Cannot impersonate your own account." },
          { status: 400 }
        )
      }

      const targetUser = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: {
          id: true,
          email: true,
          role: true,
          status: true,
          sessionVersion: true,
        },
      })

      if (!targetUser) {
        return NextResponse.json({ error: "Target user not found" }, { status: 404 })
      }

      if (targetUser.status !== "ACTIVE") {
        return NextResponse.json(
          { error: "Target user is not active" },
          { status: 400 }
        )
      }

      const session = (await db.impersonationSession.create({
        data: {
          adminId: payload.sub,
          targetUserId: targetUser.id,
          reason: reason || null,
        },
        select: {
          id: true,
        },
      })) as { id: string }

      await logAudit({
        actorId: payload.sub,
        actorEmail: payload.email,
        actorRole: payload.role,
        targetUserId: targetUser.id,
        action: "impersonation_started",
        resource: "user",
        resourceId: targetUser.id,
        metadata: {
          reason: reason || null,
        },
        impersonationSessionId: session.id,
      })

      const token = await signToken({
        sub: targetUser.id,
        email: targetUser.email,
        role: targetUser.role,
        sessionVersion: targetUser.sessionVersion,
        isImpersonating: true,
        actorSub: payload.sub,
        actorEmail: payload.email,
        actorRole: payload.role,
        actorSessionVersion: payload.sessionVersion,
        impersonationSessionId: session.id,
      })

      return NextResponse.json(
        {
          token,
          user: {
            id: targetUser.id,
            email: targetUser.email,
            role: targetUser.role,
          },
          impersonationSessionId: session.id,
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
