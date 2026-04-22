import { prisma } from "@/lib/prisma"
import type { JwtPayload } from "@/lib/auth"

const db = prisma as any

type PermissionSeed = {
  key: string
  name: string
  category: string
  description: string
}

type RoleSeed = {
  slug: string
  name: string
  description: string
  baseRole: "STUDENT" | "SUPERVISOR" | "ADMIN"
}

const PERMISSIONS: PermissionSeed[] = [
  {
    key: "admin.users.read",
    name: "View Users",
    category: "User Management",
    description: "View user list and profile details.",
  },
  {
    key: "admin.users.manage",
    name: "Manage Users",
    category: "User Management",
    description: "Invite, suspend, activate, delete users and reset credentials.",
  },
  {
    key: "admin.projects.read",
    name: "View Projects",
    category: "Projects",
    description: "View all projects and milestone snapshots.",
  },
  {
    key: "admin.projects.manage",
    name: "Manage Projects",
    category: "Projects",
    description: "Update project status, milestones, lock and reschedule timelines.",
  },
  {
    key: "admin.supervisors.manage",
    name: "Manage Supervisors",
    category: "Supervisors",
    description: "Capacity control, intake control, reassignments and nudges.",
  },
  {
    key: "admin.requests.manage",
    name: "Manage Requests",
    category: "Supervision Requests",
    description: "Force-expire or decide requests from oversight queue.",
  },
  {
    key: "admin.matching.manage",
    name: "Manage Matching",
    category: "Matching",
    description: "Tune matching weights, blacklist pairs, and rerun matching.",
  },
  {
    key: "admin.communications.manage",
    name: "Manage Communications",
    category: "Communications",
    description: "Manage announcements, templates and broadcasts.",
  },
  {
    key: "admin.system_health.read",
    name: "View System Health",
    category: "Operations",
    description: "View service status, incidents, maintenance and operations metrics.",
  },
  {
    key: "admin.reports.read",
    name: "View Analytics Reports",
    category: "Analytics",
    description: "View matching, workload, project health, and engagement analytics reports.",
  },
  {
    key: "admin.system_health.manage",
    name: "Manage System Health",
    category: "Operations",
    description: "Create incidents, configure thresholds, and schedule maintenance windows.",
  },
  {
    key: "admin.data_management.manage",
    name: "Manage Data",
    category: "Operations",
    description: "Manage backups, imports/exports, retention policies, and danger-zone actions.",
  },
  {
    key: "admin.settings.manage",
    name: "Manage Platform Settings",
    category: "Configuration",
    description: "Manage integrations, branding, security policies, and feature flags.",
  },
  {
    key: "admin.rbac.manage",
    name: "Manage Roles & Permissions",
    category: "Security",
    description: "Create custom roles and grant/revoke permissions.",
  },
  {
    key: "admin.impersonation.use",
    name: "Impersonate Users",
    category: "Security",
    description: "Start and stop support impersonation sessions.",
  },
]

const SYSTEM_ROLES: RoleSeed[] = [
  {
    slug: "student",
    name: "Student",
    description: "Default student role",
    baseRole: "STUDENT",
  },
  {
    slug: "supervisor",
    name: "Supervisor",
    description: "Default supervisor role",
    baseRole: "SUPERVISOR",
  },
  {
    slug: "admin",
    name: "Administrator",
    description: "Default admin role",
    baseRole: "ADMIN",
  },
]

const DEFAULT_GRANTS: Record<string, string[]> = {
  student: [],
  supervisor: [],
  admin: PERMISSIONS.map((permission) => permission.key),
}

function roleSlugFromBaseRole(role: JwtPayload["role"]) {
  if (role === "STUDENT") return "student"
  if (role === "SUPERVISOR") return "supervisor"
  return "admin"
}

export async function ensureRbacSeed() {
  for (const permission of PERMISSIONS) {
    await db.permission.upsert({
      where: { key: permission.key },
      update: {
        name: permission.name,
        category: permission.category,
        description: permission.description,
      },
      create: {
        key: permission.key,
        name: permission.name,
        category: permission.category,
        description: permission.description,
      },
    })
  }

  for (const role of SYSTEM_ROLES) {
    await db.customRole.upsert({
      where: { slug: role.slug },
      update: {
        name: role.name,
        description: role.description,
        isSystem: true,
        baseRole: role.baseRole,
      },
      create: {
        slug: role.slug,
        name: role.name,
        description: role.description,
        isSystem: true,
        baseRole: role.baseRole,
      },
    })
  }

  for (const role of SYSTEM_ROLES) {
    const roleRow = await db.customRole.findUnique({
      where: { slug: role.slug },
      select: { id: true },
    })
    if (!roleRow) continue

    for (const permissionKey of DEFAULT_GRANTS[role.slug] || []) {
      const permissionRow = await db.permission.findUnique({
        where: { key: permissionKey },
        select: { id: true },
      })
      if (!permissionRow) continue

      await db.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roleRow.id,
            permissionId: permissionRow.id,
          },
        },
        update: {
          granted: true,
        },
        create: {
          roleId: roleRow.id,
          permissionId: permissionRow.id,
          granted: true,
        },
      })
    }
  }
}

export async function getUserPermissions(payload: JwtPayload) {
  await ensureRbacSeed()

  const baseSlug = roleSlugFromBaseRole(payload.role)
  const baseRole = await db.customRole.findUnique({
    where: { slug: baseSlug },
    select: { id: true },
  })

  const extraAssignments = (await db.userCustomRole.findMany({
    where: {
      userId: payload.sub,
    },
    select: {
      roleId: true,
    },
  })) as Array<{ roleId: string }>

  const roleIds = Array.from(
    new Set([
      ...(baseRole ? [baseRole.id] : []),
      ...extraAssignments.map((assignment) => assignment.roleId),
    ])
  )

  if (roleIds.length === 0) {
    return new Set<string>()
  }

  const grants = (await db.rolePermission.findMany({
    where: {
      roleId: {
        in: roleIds,
      },
      granted: true,
    },
    select: {
      permission: {
        select: {
          key: true,
        },
      },
    },
  })) as Array<{ permission: { key: string } }>

  return new Set(grants.map((grant) => grant.permission.key))
}

export async function hasPermission(
  payload: JwtPayload | null,
  permissionKey: string
) {
  if (!payload) return false
  const permissions = await getUserPermissions(payload)
  return permissions.has(permissionKey)
}

export async function listPermissionCatalog() {
  await ensureRbacSeed()
  return (await db.permission.findMany({
    orderBy: [{ category: "asc" }, { key: "asc" }],
    select: {
      id: true,
      key: true,
      name: true,
      category: true,
      description: true,
    },
  })) as Array<{
    id: string
    key: string
    name: string
    category: string
    description: string | null
  }>
}
