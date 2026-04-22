import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { AccountStatus, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { logAudit } from "@/lib/audit"

const db = prisma as any

type SnapshotPayload = Record<string, unknown[]>

type ParsedCsv = {
  headers: string[]
  rows: string[][]
}

const BACKUP_TABLE_MAP: Array<{ key: string; table: string }> = [
  { key: "users", table: "User" },
  { key: "studentProfiles", table: "StudentProfile" },
  { key: "supervisorProfiles", table: "SupervisorProfile" },
  { key: "projects", table: "Project" },
  { key: "milestones", table: "Milestone" },
  { key: "supervisionRequests", table: "SupervisionRequest" },
  { key: "messages", table: "Message" },
  { key: "meetings", table: "Meeting" },
  { key: "notifications", table: "Notification" },
  { key: "academicPeriods", table: "AcademicPeriod" },
  { key: "timelineRescheduleEvents", table: "TimelineRescheduleEvent" },
  { key: "matchingConfigs", table: "MatchingConfig" },
  { key: "requestOversightConfigs", table: "RequestOversightConfig" },
  { key: "matchingBlacklists", table: "MatchingBlacklist" },
  { key: "matchRecommendations", table: "MatchRecommendation" },
  { key: "announcements", table: "Announcement" },
  { key: "emailTemplates", table: "EmailTemplate" },
  { key: "serviceHealthSnapshots", table: "ServiceHealthSnapshot" },
  { key: "serviceIncidents", table: "ServiceIncident" },
  { key: "maintenanceWindows", table: "MaintenanceWindow" },
  { key: "systemHealthConfigs", table: "SystemHealthConfig" },
  { key: "systemHealthSignals", table: "SystemHealthSignal" },
  { key: "permissions", table: "Permission" },
  { key: "customRoles", table: "CustomRole" },
  { key: "rolePermissions", table: "RolePermission" },
  { key: "userCustomRoles", table: "UserCustomRole" },
  { key: "impersonationSessions", table: "ImpersonationSession" },
  { key: "auditLogs", table: "AuditLog" },
]

function toPositiveInt(value: unknown, fallback: number, min = 1, max = 36500) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN
  if (!Number.isFinite(numeric)) return fallback
  const rounded = Math.floor(numeric)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

function toFrequency(value: unknown): "HOURLY" | "DAILY" | "WEEKLY" {
  if (value === "HOURLY" || value === "DAILY" || value === "WEEKLY") {
    return value
  }
  if (value === "hourly") return "HOURLY"
  if (value === "weekly") return "WEEKLY"
  return "DAILY"
}

function normalizeStatus(value: unknown): AccountStatus | null {
  if (value === "ACTIVE" || value === "SUSPENDED" || value === "PENDING") {
    return value
  }
  if (typeof value !== "string") return null
  const normalized = value.trim().toUpperCase()
  if (normalized === "ACTIVE") return AccountStatus.ACTIVE
  if (normalized === "SUSPENDED") return AccountStatus.SUSPENDED
  if (normalized === "PENDING") return AccountStatus.PENDING
  return null
}

function normalizeRole(value: unknown): Role | null {
  if (value === "STUDENT" || value === "SUPERVISOR" || value === "ADMIN") {
    return value
  }
  if (typeof value !== "string") return null
  const normalized = value.trim().toUpperCase()
  if (normalized === "STUDENT") return Role.STUDENT
  if (normalized === "SUPERVISOR") return Role.SUPERVISOR
  if (normalized === "ADMIN") return Role.ADMIN
  return null
}

function maskEmail(email: string, id: string) {
  const seed = id.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10) || "user"
  return `${seed}@masked.local`
}

function maskName(name: string | null | undefined, fallback: string) {
  if (!name) return fallback
  return `Redacted ${fallback}`
}

function sqlLiteral(value: unknown) {
  if (value === null || typeof value === "undefined") return "NULL"
  if (typeof value === "number") return Number.isFinite(value) ? `${value}` : "NULL"
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE"
  if (typeof value === "object") {
    const serialized = JSON.stringify(value).replace(/'/g, "''")
    return `'${serialized}'::jsonb`
  }
  const serialized = `${value}`.replace(/'/g, "''")
  return `'${serialized}'`
}

function buildSqlDump(snapshot: SnapshotPayload) {
  const now = new Date().toISOString()
  const lines: string[] = [
    "-- Supervisor Works SQL export",
    `-- Generated at ${now}`,
    "BEGIN;",
  ]

  const tableNames = BACKUP_TABLE_MAP.map((item) => `"${item.table}"`).join(", ")
  if (tableNames) {
    lines.push(`TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`)
  }

  for (const table of BACKUP_TABLE_MAP) {
    const rows = snapshot[table.key]
    if (!Array.isArray(rows) || rows.length === 0) continue

    const firstRow = rows[0]
    if (!firstRow || typeof firstRow !== "object" || Array.isArray(firstRow)) continue

    const columns = Object.keys(firstRow as Record<string, unknown>)
    if (columns.length === 0) continue

    const values = rows
      .map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          return null
        }
        const tuple = columns
          .map((column) => sqlLiteral((row as Record<string, unknown>)[column]))
          .join(", ")
        return `(${tuple})`
      })
      .filter((tuple): tuple is string => Boolean(tuple))

    if (values.length === 0) continue

    lines.push(
      `INSERT INTO "${table.table}" (${columns.map((column) => `"${column}"`).join(", ")}) VALUES`
    )
    lines.push(`${values.join(",\n")};`)
  }

  lines.push("COMMIT;")
  return lines.join("\n")
}

function parseCsv(text: string): ParsedCsv {
  const rows: string[][] = []
  let current = ""
  let row: string[] = []
  let inQuotes = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = i + 1 < text.length ? text[i + 1] : ""

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        i += 1
        continue
      }
      inQuotes = !inQuotes
      continue
    }

    if (char === "," && !inQuotes) {
      row.push(current.trim())
      current = ""
      continue
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        i += 1
      }
      row.push(current.trim())
      current = ""
      if (row.some((value) => value.length > 0)) {
        rows.push(row)
      }
      row = []
      continue
    }

    current += char
  }

  row.push(current.trim())
  if (row.some((value) => value.length > 0)) {
    rows.push(row)
  }

  if (rows.length === 0) {
    return { headers: [], rows: [] }
  }

  const [headerRow, ...dataRows] = rows
  const headers = headerRow.map((header) => header.trim().toLowerCase())
  return { headers, rows: dataRows }
}

async function requireAdmin(req: Request) {
  const payload = await verifyTokenFromHeader(req.headers.get("authorization"), {
    path: new URL(req.url).pathname,
    method: req.method,
  })

  if (!payload) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (!requireRole(payload, "ADMIN")) {
    const permitted = await hasPermission(payload, "admin.data_management.manage")
    if (!permitted) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }
    }
  }

  return { ok: true as const, payload }
}

async function ensureConfig() {
  return db.dataManagementConfig.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      autoBackupEnabled: true,
      backupFrequency: "DAILY",
      backupRetentionDays: 30,
      piiMaskBackups: true,
      completedProjectRetentionDays: 365,
      messageRetentionDays: 365,
      auditLogRetentionDays: 730,
    },
  })
}

async function buildSnapshot(piiMasked: boolean) {
  const [
    users,
    studentProfiles,
    supervisorProfiles,
    projects,
    milestones,
    supervisionRequests,
    messages,
    meetings,
    notifications,
    academicPeriods,
    timelineRescheduleEvents,
    matchingConfigs,
    requestOversightConfigs,
    matchingBlacklists,
    matchRecommendations,
    announcements,
    emailTemplates,
    serviceHealthSnapshots,
    serviceIncidents,
    maintenanceWindows,
    systemHealthConfigs,
    systemHealthSignals,
    permissions,
    customRoles,
    rolePermissions,
    userCustomRoles,
    impersonationSessions,
    auditLogs,
  ] = await Promise.all([
    db.user.findMany(),
    db.studentProfile.findMany(),
    db.supervisorProfile.findMany(),
    db.project.findMany(),
    db.milestone.findMany(),
    db.supervisionRequest.findMany(),
    db.message.findMany(),
    db.meeting.findMany(),
    db.notification.findMany(),
    db.academicPeriod.findMany(),
    db.timelineRescheduleEvent.findMany(),
    db.matchingConfig.findMany(),
    db.requestOversightConfig.findMany(),
    db.matchingBlacklist.findMany(),
    db.matchRecommendation.findMany(),
    db.announcement.findMany(),
    db.emailTemplate.findMany(),
    db.serviceHealthSnapshot.findMany(),
    db.serviceIncident.findMany(),
    db.maintenanceWindow.findMany(),
    db.systemHealthConfig.findMany(),
    db.systemHealthSignal.findMany(),
    db.permission.findMany(),
    db.customRole.findMany(),
    db.rolePermission.findMany(),
    db.userCustomRole.findMany(),
    db.impersonationSession.findMany(),
    db.auditLog.findMany(),
  ])

  const snapshotUsers = piiMasked
    ? users.map((user: Record<string, unknown>) => ({
        ...user,
        email:
          typeof user.email === "string" && typeof user.id === "string"
            ? maskEmail(user.email, user.id)
            : user.email,
      }))
    : users

  const snapshotStudentProfiles = piiMasked
    ? studentProfiles.map((profile: Record<string, unknown>) => ({
        ...profile,
        fullName:
          typeof profile.fullName === "string"
            ? maskName(profile.fullName, "Student")
            : profile.fullName,
      }))
    : studentProfiles

  const snapshotSupervisorProfiles = piiMasked
    ? supervisorProfiles.map((profile: Record<string, unknown>) => ({
        ...profile,
        fullName:
          typeof profile.fullName === "string"
            ? maskName(profile.fullName, "Supervisor")
            : profile.fullName,
      }))
    : supervisorProfiles

  const snapshot = {
    users: snapshotUsers,
    studentProfiles: snapshotStudentProfiles,
    supervisorProfiles: snapshotSupervisorProfiles,
    projects,
    milestones,
    supervisionRequests,
    messages,
    meetings,
    notifications,
    academicPeriods,
    timelineRescheduleEvents,
    matchingConfigs,
    requestOversightConfigs,
    matchingBlacklists,
    matchRecommendations,
    announcements,
    emailTemplates,
    serviceHealthSnapshots,
    serviceIncidents,
    maintenanceWindows,
    systemHealthConfigs,
    systemHealthSignals,
    permissions,
    customRoles,
    rolePermissions,
    userCustomRoles,
    impersonationSessions,
    auditLogs,
  }

  const recordCount = Object.values(snapshot).reduce((sum, items) => {
    return sum + (Array.isArray(items) ? items.length : 0)
  }, 0)
  const sizeBytes = Buffer.byteLength(JSON.stringify(snapshot), "utf8")

  return {
    snapshot,
    recordCount,
    sizeBytes,
  }
}

async function applyBackupRetention(retentionDays: number) {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - retentionDays)
  await db.dataBackup.deleteMany({
    where: {
      createdAt: {
        lt: cutoff,
      },
    },
  })
}

async function restoreSnapshot(snapshot: SnapshotPayload) {
  await prisma.$transaction(async (tx) => {
    const dbTx = tx as any
    await dbTx.rolePermission.deleteMany()
    await dbTx.userCustomRole.deleteMany()
    await dbTx.matchRecommendation.deleteMany()
    await dbTx.matchingBlacklist.deleteMany()
    await dbTx.timelineRescheduleEvent.deleteMany()
    await dbTx.notification.deleteMany()
    await dbTx.message.deleteMany()
    await dbTx.meeting.deleteMany()
    await dbTx.supervisionRequest.deleteMany()
    await dbTx.milestone.deleteMany()
    await dbTx.project.deleteMany()
    await dbTx.studentProfile.deleteMany()
    await dbTx.supervisorProfile.deleteMany()
    await dbTx.announcement.deleteMany()
    await dbTx.emailTemplate.deleteMany()
    await dbTx.serviceHealthSnapshot.deleteMany()
    await dbTx.serviceIncident.deleteMany()
    await dbTx.maintenanceWindow.deleteMany()
    await dbTx.impersonationSession.deleteMany()
    await dbTx.auditLog.deleteMany()
    await dbTx.customRole.deleteMany()
    await dbTx.permission.deleteMany()
    await dbTx.matchingConfig.deleteMany()
    await dbTx.requestOversightConfig.deleteMany()
    await dbTx.academicPeriod.deleteMany()
    await dbTx.systemHealthConfig.deleteMany()
    await dbTx.systemHealthSignal.deleteMany()
    await dbTx.user.deleteMany()

    const insert = async (modelName: string, key: string) => {
      const records = snapshot[key]
      if (!Array.isArray(records) || records.length === 0) return
      await dbTx[modelName].createMany({
        data: records,
      })
    }

    await insert("user", "users")
    await insert("studentProfile", "studentProfiles")
    await insert("supervisorProfile", "supervisorProfiles")
    await insert("academicPeriod", "academicPeriods")
    await insert("project", "projects")
    await insert("milestone", "milestones")
    await insert("supervisionRequest", "supervisionRequests")
    await insert("message", "messages")
    await insert("meeting", "meetings")
    await insert("notification", "notifications")
    await insert("timelineRescheduleEvent", "timelineRescheduleEvents")
    await insert("matchingConfig", "matchingConfigs")
    await insert("requestOversightConfig", "requestOversightConfigs")
    await insert("matchingBlacklist", "matchingBlacklists")
    await insert("matchRecommendation", "matchRecommendations")
    await insert("announcement", "announcements")
    await insert("emailTemplate", "emailTemplates")
    await insert("serviceHealthSnapshot", "serviceHealthSnapshots")
    await insert("serviceIncident", "serviceIncidents")
    await insert("maintenanceWindow", "maintenanceWindows")
    await insert("systemHealthConfig", "systemHealthConfigs")
    await insert("systemHealthSignal", "systemHealthSignals")
    await insert("permission", "permissions")
    await insert("customRole", "customRoles")
    await insert("rolePermission", "rolePermissions")
    await insert("userCustomRole", "userCustomRoles")
    await insert("impersonationSession", "impersonationSessions")
    await insert("auditLog", "auditLogs")
  })
}

async function runRetentionCleanup(config: {
  completedProjectRetentionDays: number
  messageRetentionDays: number
  auditLogRetentionDays: number
}) {
  const projectCutoff = new Date()
  projectCutoff.setDate(projectCutoff.getDate() - config.completedProjectRetentionDays)

  const messageCutoff = new Date()
  messageCutoff.setDate(messageCutoff.getDate() - config.messageRetentionDays)

  const auditCutoff = new Date()
  auditCutoff.setDate(auditCutoff.getDate() - config.auditLogRetentionDays)

  const [projectsDeleted, messagesDeleted, auditDeleted] = await prisma.$transaction([
    prisma.project.deleteMany({
      where: {
        updatedAt: { lt: projectCutoff },
        status: {
          in: ["completed", "submitted", "abandoned", "withdrawn"],
        },
      },
    }),
    prisma.message.deleteMany({
      where: {
        createdAt: { lt: messageCutoff },
      },
    }),
    prisma.auditLog.deleteMany({
      where: {
        createdAt: { lt: auditCutoff },
      },
    }),
  ])

  return {
    projectsDeleted: projectsDeleted.count,
    messagesDeleted: messagesDeleted.count,
    auditDeleted: auditDeleted.count,
  }
}

async function importStudents(parsed: ParsedCsv, initiatedById: string, initiatedByEmail: string) {
  let createdCount = 0
  let updatedCount = 0
  let failedCount = 0
  const errors: string[] = []
  const headers = parsed.headers

  const emailIdx = headers.indexOf("email")
  const nameIdx = headers.indexOf("fullname")
  const skillsIdx = headers.indexOf("skills")
  const interestsIdx = headers.indexOf("interests")
  const statusIdx = headers.indexOf("status")

  if (emailIdx < 0) {
    return {
      processedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      failedCount: parsed.rows.length,
      errors: ['Missing required "email" header'],
    }
  }

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const row = parsed.rows[i]
    const email = (row[emailIdx] || "").trim().toLowerCase()
    const fullName = nameIdx >= 0 ? (row[nameIdx] || "").trim() : ""
    const skills = skillsIdx >= 0 ? (row[skillsIdx] || "").trim() : ""
    const interests = interestsIdx >= 0 ? (row[interestsIdx] || "").trim() : ""
    const status = statusIdx >= 0 ? normalizeStatus(row[statusIdx]) : AccountStatus.PENDING

    if (!email) {
      failedCount += 1
      errors.push(`Row ${i + 2}: email is required`)
      continue
    }

    try {
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })

      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            role: Role.STUDENT,
            status: status || AccountStatus.PENDING,
            studentProfile: {
              upsert: {
                create: {
                  fullName: fullName || null,
                  skills: skills || null,
                  interests: interests || null,
                },
                update: {
                  fullName: fullName || null,
                  skills: skills || null,
                  interests: interests || null,
                },
              },
            },
          },
        })
        updatedCount += 1
        continue
      }

      const temporaryPassword = randomBytes(9).toString("base64url")
      const passwordHash = await bcrypt.hash(temporaryPassword, 12)

      await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: Role.STUDENT,
          status: status || AccountStatus.PENDING,
          studentProfile: {
            create: {
              fullName: fullName || null,
              skills: skills || null,
              interests: interests || null,
            },
          },
        },
      })
      createdCount += 1
    } catch (err: any) {
      failedCount += 1
      errors.push(`Row ${i + 2}: ${err?.message || "Failed to import student"}`)
    }
  }

  await db.dataImportJob.create({
    data: {
      entityType: "students",
      status: failedCount > 0 ? "completed_with_errors" : "completed",
      processedCount: parsed.rows.length,
      createdCount,
      updatedCount,
      failedCount,
      errors: errors.slice(0, 50),
      initiatedById,
      initiatedByEmail,
    },
  })

  return {
    processedCount: parsed.rows.length,
    createdCount,
    updatedCount,
    failedCount,
    errors,
  }
}

async function importSupervisors(parsed: ParsedCsv, initiatedById: string, initiatedByEmail: string) {
  let createdCount = 0
  let updatedCount = 0
  let failedCount = 0
  const errors: string[] = []
  const headers = parsed.headers

  const emailIdx = headers.indexOf("email")
  const nameIdx = headers.indexOf("fullname")
  const expertiseIdx = headers.indexOf("expertise")
  const capacityIdx = headers.indexOf("maxcapacity")
  const intakeIdx = headers.indexOf("acceptingstudents")
  const statusIdx = headers.indexOf("status")

  if (emailIdx < 0) {
    return {
      processedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      failedCount: parsed.rows.length,
      errors: ['Missing required "email" header'],
    }
  }

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const row = parsed.rows[i]
    const email = (row[emailIdx] || "").trim().toLowerCase()
    const fullName = nameIdx >= 0 ? (row[nameIdx] || "").trim() : ""
    const expertise = expertiseIdx >= 0 ? (row[expertiseIdx] || "").trim() : ""
    const maxCapacity = capacityIdx >= 0 ? toPositiveInt(row[capacityIdx], 5, 1, 50) : 5
    const acceptingStudents =
      intakeIdx >= 0 ? (row[intakeIdx] || "").trim().toLowerCase() !== "false" : true
    const status = statusIdx >= 0 ? normalizeStatus(row[statusIdx]) : AccountStatus.PENDING

    if (!email) {
      failedCount += 1
      errors.push(`Row ${i + 2}: email is required`)
      continue
    }

    try {
      const existing = await prisma.user.findUnique({
        where: { email },
        select: { id: true },
      })

      if (existing) {
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            role: Role.SUPERVISOR,
            status: status || AccountStatus.PENDING,
            supervisorProfile: {
              upsert: {
                create: {
                  fullName: fullName || null,
                  expertise: expertise || null,
                  maxCapacity,
                  acceptingStudents,
                },
                update: {
                  fullName: fullName || null,
                  expertise: expertise || null,
                  maxCapacity,
                  acceptingStudents,
                },
              },
            },
          },
        })
        updatedCount += 1
        continue
      }

      const temporaryPassword = randomBytes(9).toString("base64url")
      const passwordHash = await bcrypt.hash(temporaryPassword, 12)

      await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: Role.SUPERVISOR,
          status: status || AccountStatus.PENDING,
          supervisorProfile: {
            create: {
              fullName: fullName || null,
              expertise: expertise || null,
              maxCapacity,
              acceptingStudents,
            },
          },
        },
      })
      createdCount += 1
    } catch (err: any) {
      failedCount += 1
      errors.push(`Row ${i + 2}: ${err?.message || "Failed to import supervisor"}`)
    }
  }

  await db.dataImportJob.create({
    data: {
      entityType: "supervisors",
      status: failedCount > 0 ? "completed_with_errors" : "completed",
      processedCount: parsed.rows.length,
      createdCount,
      updatedCount,
      failedCount,
      errors: errors.slice(0, 50),
      initiatedById,
      initiatedByEmail,
    },
  })

  return {
    processedCount: parsed.rows.length,
    createdCount,
    updatedCount,
    failedCount,
    errors,
  }
}

async function importProjects(parsed: ParsedCsv, initiatedById: string, initiatedByEmail: string) {
  let createdCount = 0
  let updatedCount = 0
  let failedCount = 0
  const errors: string[] = []
  const headers = parsed.headers

  const studentEmailIdx = headers.indexOf("studentemail")
  const titleIdx = headers.indexOf("title")
  const descriptionIdx = headers.indexOf("description")
  const keywordsIdx = headers.indexOf("keywords")
  const statusIdx = headers.indexOf("status")

  if (studentEmailIdx < 0) {
    return {
      processedCount: 0,
      createdCount: 0,
      updatedCount: 0,
      failedCount: parsed.rows.length,
      errors: ['Missing required "studentEmail" header'],
    }
  }

  for (let i = 0; i < parsed.rows.length; i += 1) {
    const row = parsed.rows[i]
    const studentEmail = (row[studentEmailIdx] || "").trim().toLowerCase()
    const title = titleIdx >= 0 ? (row[titleIdx] || "").trim() : ""
    const description = descriptionIdx >= 0 ? (row[descriptionIdx] || "").trim() : ""
    const keywords = keywordsIdx >= 0 ? (row[keywordsIdx] || "").trim() : ""
    const status = statusIdx >= 0 ? (row[statusIdx] || "").trim().toLowerCase() : "draft"

    if (!studentEmail) {
      failedCount += 1
      errors.push(`Row ${i + 2}: studentEmail is required`)
      continue
    }

    try {
      const student = await prisma.user.findUnique({
        where: { email: studentEmail },
        select: { id: true },
      })

      if (!student) {
        failedCount += 1
        errors.push(`Row ${i + 2}: student "${studentEmail}" not found`)
        continue
      }

      const existing = await prisma.project.findUnique({
        where: { studentId: student.id },
        select: { id: true },
      })

      if (existing) {
        await prisma.project.update({
          where: { id: existing.id },
          data: {
            title: title || null,
            description: description || null,
            keywords: keywords || null,
            status: status || "draft",
          },
        })
        updatedCount += 1
        continue
      }

      await prisma.project.create({
        data: {
          studentId: student.id,
          title: title || null,
          description: description || null,
          keywords: keywords || null,
          status: status || "draft",
        },
      })
      createdCount += 1
    } catch (err: any) {
      failedCount += 1
      errors.push(`Row ${i + 2}: ${err?.message || "Failed to import project"}`)
    }
  }

  await db.dataImportJob.create({
    data: {
      entityType: "projects",
      status: failedCount > 0 ? "completed_with_errors" : "completed",
      processedCount: parsed.rows.length,
      createdCount,
      updatedCount,
      failedCount,
      errors: errors.slice(0, 50),
      initiatedById,
      initiatedByEmail,
    },
  })

  return {
    processedCount: parsed.rows.length,
    createdCount,
    updatedCount,
    failedCount,
    errors,
  }
}

async function getPayload() {
  const config = await ensureConfig()
  const [summary, backups, imports, audits, academicPeriods] = await Promise.all([
    prisma.$transaction([
      prisma.user.count(),
      prisma.user.count({ where: { role: Role.STUDENT } }),
      prisma.user.count({ where: { role: Role.SUPERVISOR } }),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.project.count(),
      prisma.milestone.count(),
      prisma.supervisionRequest.count(),
      prisma.message.count(),
      prisma.meeting.count(),
      prisma.notification.count(),
      db.dataBackup.count(),
      db.dataImportJob.count(),
    ]),
    db.dataBackup.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        type: true,
        status: true,
        format: true,
        piiMasked: true,
        recordCount: true,
        sizeBytes: true,
        createdByEmail: true,
        createdAt: true,
        restoredAt: true,
      },
    }),
    db.dataImportJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    db.auditLog.findMany({
      where: {
        action: {
          startsWith: "data_management.",
        },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        action: true,
        actorEmail: true,
        createdAt: true,
        metadata: true,
      },
    }),
    db.academicPeriod.findMany({
      orderBy: [{ startDate: "desc" }],
      select: {
        id: true,
        name: true,
        isActive: true,
        isArchived: true,
      },
    }),
  ])

  return {
    config,
    summary: {
      users: summary[0],
      students: summary[1],
      supervisors: summary[2],
      admins: summary[3],
      projects: summary[4],
      milestones: summary[5],
      requests: summary[6],
      messages: summary[7],
      meetings: summary[8],
      notifications: summary[9],
      backups: summary[10],
      importJobs: summary[11],
    },
    backups,
    imports,
    audits,
    academicPeriods,
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const downloadId = searchParams.get("downloadId")?.trim()
    const formatParam = searchParams.get("format")?.trim().toLowerCase()

    if (downloadId) {
      const backup = await db.dataBackup.findUnique({
        where: { id: downloadId },
      })

      if (!backup || !backup.snapshot) {
        return NextResponse.json({ error: "Backup not found" }, { status: 404 })
      }

      const format = formatParam === "sql" ? "sql" : "json"
      const snapshot = backup.snapshot as SnapshotPayload
      const content =
        format === "sql"
          ? buildSqlDump(snapshot)
          : JSON.stringify(
              {
                generatedAt: new Date().toISOString(),
                backupId: backup.id,
                piiMasked: backup.piiMasked,
                snapshot,
              },
              null,
              2
            )

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.download_backup",
        resource: "data_backup",
        resourceId: backup.id,
        metadata: {
          format,
        },
      })

      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type":
            format === "sql" ? "application/sql; charset=utf-8" : "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="backup-${backup.id}.${format}"`,
        },
      })
    }

    const payload = await getPayload()
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to load data management state" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const config = await ensureConfig()
    const updated = await db.dataManagementConfig.update({
      where: { id: "global" },
      data: {
        autoBackupEnabled:
          typeof body.autoBackupEnabled === "boolean"
            ? body.autoBackupEnabled
            : config.autoBackupEnabled,
        backupFrequency:
          typeof body.backupFrequency !== "undefined"
            ? toFrequency(body.backupFrequency)
            : config.backupFrequency,
        backupRetentionDays:
          typeof body.backupRetentionDays !== "undefined"
            ? toPositiveInt(body.backupRetentionDays, config.backupRetentionDays, 1, 3650)
            : config.backupRetentionDays,
        piiMaskBackups:
          typeof body.piiMaskBackups === "boolean"
            ? body.piiMaskBackups
            : config.piiMaskBackups,
        completedProjectRetentionDays:
          typeof body.completedProjectRetentionDays !== "undefined"
            ? toPositiveInt(
                body.completedProjectRetentionDays,
                config.completedProjectRetentionDays,
                1,
                36500
              )
            : config.completedProjectRetentionDays,
        messageRetentionDays:
          typeof body.messageRetentionDays !== "undefined"
            ? toPositiveInt(body.messageRetentionDays, config.messageRetentionDays, 1, 36500)
            : config.messageRetentionDays,
        auditLogRetentionDays:
          typeof body.auditLogRetentionDays !== "undefined"
            ? toPositiveInt(body.auditLogRetentionDays, config.auditLogRetentionDays, 1, 36500)
            : config.auditLogRetentionDays,
      },
    })

    await applyBackupRetention(updated.backupRetentionDays)

    await logAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRole: auth.payload.role,
      action: "data_management.update_config",
      resource: "data_management_config",
      resourceId: "global",
      metadata: {
        autoBackupEnabled: updated.autoBackupEnabled,
        backupFrequency: updated.backupFrequency,
        backupRetentionDays: updated.backupRetentionDays,
        piiMaskBackups: updated.piiMaskBackups,
        completedProjectRetentionDays: updated.completedProjectRetentionDays,
        messageRetentionDays: updated.messageRetentionDays,
        auditLogRetentionDays: updated.auditLogRetentionDays,
      },
    })

    const payload = await getPayload()
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Failed to update settings" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.trim() : ""
    const config = await ensureConfig()

    if (action === "create_backup") {
      const requestedFormat =
        typeof body.format === "string" && body.format.trim().toLowerCase() === "sql"
          ? "sql"
          : "json"
      const piiMasked =
        typeof body.piiMasked === "boolean" ? body.piiMasked : config.piiMaskBackups

      const seedBackup = await db.dataBackup.create({
        data: {
          type: "MANUAL",
          status: "IN_PROGRESS",
          format: requestedFormat,
          piiMasked,
          downloadToken: randomBytes(16).toString("hex"),
          createdById: auth.payload.sub,
          createdByEmail: auth.payload.email,
        },
      })

      try {
        const snapshot = await buildSnapshot(piiMasked)
        const backup = await db.dataBackup.update({
          where: { id: seedBackup.id },
          data: {
            status: "COMPLETED",
            snapshot: snapshot.snapshot,
            recordCount: snapshot.recordCount,
            sizeBytes: snapshot.sizeBytes,
          },
        })

        await applyBackupRetention(config.backupRetentionDays)

        await logAudit({
          actorId: auth.payload.sub,
          actorEmail: auth.payload.email,
          actorRole: auth.payload.role,
          action: "data_management.create_backup",
          resource: "data_backup",
          resourceId: backup.id,
          metadata: {
            piiMasked,
            format: requestedFormat,
            recordCount: snapshot.recordCount,
            sizeBytes: snapshot.sizeBytes,
          },
        })
      } catch (err) {
        await db.dataBackup.update({
          where: { id: seedBackup.id },
          data: {
            status: "FAILED",
          },
        })
        throw err
      }

      const payload = await getPayload()
      return NextResponse.json(payload, { status: 200 })
    }

    if (action === "restore_backup") {
      const backupId = typeof body.backupId === "string" ? body.backupId.trim() : ""
      const confirmPhrase =
        typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : ""
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""

      if (!backupId) {
        return NextResponse.json({ error: "backupId is required" }, { status: 400 })
      }
      if (confirmPhrase !== "RESTORE") {
        return NextResponse.json(
          { error: 'Type RESTORE in the confirmation field to continue.' },
          { status: 400 }
        )
      }
      if (!reason) {
        return NextResponse.json({ error: "Restore reason is required" }, { status: 400 })
      }

      const backup = await db.dataBackup.findUnique({
        where: { id: backupId },
      })
      if (!backup || !backup.snapshot) {
        return NextResponse.json({ error: "Backup not found" }, { status: 404 })
      }
      if (backup.piiMasked) {
        return NextResponse.json(
          { error: "Masked backups cannot be restored safely. Use an unmasked backup." },
          { status: 400 }
        )
      }

      const snapshot = backup.snapshot as SnapshotPayload
      await restoreSnapshot(snapshot)

      await db.dataBackup.update({
        where: { id: backup.id },
        data: {
          restoredAt: new Date(),
          restoreReason: reason,
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.restore_backup",
        resource: "data_backup",
        resourceId: backup.id,
        metadata: {
          reason,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(payload, { status: 200 })
    }

    if (action === "bulk_import") {
      const entityType =
        typeof body.entityType === "string" ? body.entityType.trim().toLowerCase() : ""
      const csv = typeof body.csv === "string" ? body.csv : ""

      if (!csv.trim()) {
        return NextResponse.json({ error: "CSV content is required" }, { status: 400 })
      }
      if (!["students", "supervisors", "projects"].includes(entityType)) {
        return NextResponse.json(
          { error: 'entityType must be one of "students", "supervisors", or "projects"' },
          { status: 400 }
        )
      }

      const parsed = parseCsv(csv)
      if (parsed.headers.length === 0) {
        return NextResponse.json({ error: "CSV appears to be empty" }, { status: 400 })
      }

      const result =
        entityType === "students"
          ? await importStudents(parsed, auth.payload.sub, auth.payload.email)
          : entityType === "supervisors"
            ? await importSupervisors(parsed, auth.payload.sub, auth.payload.email)
            : await importProjects(parsed, auth.payload.sub, auth.payload.email)

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.bulk_import",
        resource: "bulk_import",
        metadata: {
          entityType,
          processedCount: result.processedCount,
          createdCount: result.createdCount,
          updatedCount: result.updatedCount,
          failedCount: result.failedCount,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          importResult: {
            ...result,
            errors: result.errors.slice(0, 15),
          },
        },
        { status: 200 }
      )
    }

    if (action === "bulk_export") {
      const format =
        typeof body.format === "string" && body.format.trim().toLowerCase() === "sql"
          ? "sql"
          : "json"
      const piiMasked =
        typeof body.piiMasked === "boolean" ? body.piiMasked : config.piiMaskBackups

      const snapshot = await buildSnapshot(piiMasked)
      const content =
        format === "sql"
          ? buildSqlDump(snapshot.snapshot)
          : JSON.stringify(
              {
                generatedAt: new Date().toISOString(),
                piiMasked,
                snapshot: snapshot.snapshot,
              },
              null,
              2
            )

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.bulk_export",
        resource: "bulk_export",
        metadata: {
          format,
          piiMasked,
          recordCount: snapshot.recordCount,
          sizeBytes: snapshot.sizeBytes,
        },
      })

      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type":
            format === "sql" ? "application/sql; charset=utf-8" : "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="platform-export-${new Date().toISOString().slice(0, 10)}.${format}"`,
        },
      })
    }

    if (action === "run_retention_cleanup") {
      const result = await runRetentionCleanup({
        completedProjectRetentionDays: config.completedProjectRetentionDays,
        messageRetentionDays: config.messageRetentionDays,
        auditLogRetentionDays: config.auditLogRetentionDays,
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.run_retention_cleanup",
        resource: "retention_cleanup",
        metadata: result,
      })

      const payload = await getPayload()
      return NextResponse.json({ ...payload, cleanupResult: result }, { status: 200 })
    }

    if (action === "purge_inactive_users") {
      const confirmPhrase =
        typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : ""
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""
      const daysInactive = toPositiveInt(body.daysInactive, 180, 1, 36500)

      if (confirmPhrase !== "PURGE") {
        return NextResponse.json(
          { error: 'Type PURGE in the confirmation field to continue.' },
          { status: 400 }
        )
      }
      if (!reason) {
        return NextResponse.json({ error: "Purge reason is required" }, { status: 400 })
      }

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - daysInactive)

      const deleted = await prisma.user.deleteMany({
        where: {
          id: {
            not: auth.payload.sub,
          },
          role: {
            not: Role.ADMIN,
          },
          OR: [
            {
              status: AccountStatus.PENDING,
              createdAt: { lt: cutoff },
            },
            {
              status: AccountStatus.SUSPENDED,
              updatedAt: { lt: cutoff },
            },
          ],
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.purge_inactive_users",
        resource: "users",
        metadata: {
          daysInactive,
          deletedCount: deleted.count,
          reason,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          purgeResult: {
            deletedCount: deleted.count,
          },
        },
        { status: 200 }
      )
    }

    if (action === "reset_matching_recommendations") {
      const confirmPhrase =
        typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : ""
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""

      if (confirmPhrase !== "RESET MATCHING") {
        return NextResponse.json(
          { error: 'Type RESET MATCHING in the confirmation field to continue.' },
          { status: 400 }
        )
      }
      if (!reason) {
        return NextResponse.json({ error: "Reason is required" }, { status: 400 })
      }

      const deleted = await prisma.matchRecommendation.deleteMany({})

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.reset_matching_recommendations",
        resource: "match_recommendations",
        metadata: {
          deletedCount: deleted.count,
          reason,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          matchingResetResult: {
            deletedCount: deleted.count,
          },
        },
        { status: 200 }
      )
    }

    if (action === "purge_old_requests") {
      const confirmPhrase =
        typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : ""
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""
      const daysOld = toPositiveInt(body.daysOld, 60, 1, 36500)

      if (confirmPhrase !== "PURGE REQUESTS") {
        return NextResponse.json(
          { error: 'Type PURGE REQUESTS in the confirmation field to continue.' },
          { status: 400 }
        )
      }
      if (!reason) {
        return NextResponse.json({ error: "Reason is required" }, { status: 400 })
      }

      const cutoff = new Date()
      cutoff.setDate(cutoff.getDate() - daysOld)

      const deleted = await prisma.supervisionRequest.deleteMany({
        where: {
          status: {
            in: ["declined", "withdrawn", "expired", "cancelled"],
          },
          OR: [
            {
              respondedAt: {
                lt: cutoff,
              },
            },
            {
              createdAt: {
                lt: cutoff,
              },
            },
          ],
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.purge_old_requests",
        resource: "supervision_requests",
        metadata: {
          deletedCount: deleted.count,
          daysOld,
          reason,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          requestsPurgeResult: {
            deletedCount: deleted.count,
          },
        },
        { status: 200 }
      )
    }

    if (action === "delete_academic_period") {
      const periodId = typeof body.periodId === "string" ? body.periodId.trim() : ""
      const confirmPhrase =
        typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : ""
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""

      if (!periodId) {
        return NextResponse.json({ error: "periodId is required" }, { status: 400 })
      }
      if (confirmPhrase !== "DELETE PERIOD") {
        return NextResponse.json(
          { error: 'Type DELETE PERIOD in the confirmation field to continue.' },
          { status: 400 }
        )
      }
      if (!reason) {
        return NextResponse.json({ error: "Reason is required" }, { status: 400 })
      }

      const period = await prisma.academicPeriod.findUnique({
        where: { id: periodId },
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      })

      if (!period) {
        return NextResponse.json({ error: "Academic period not found" }, { status: 404 })
      }

      if (period.isActive) {
        return NextResponse.json(
          { error: "Cannot delete the active academic period. Set another period active first." },
          { status: 400 }
        )
      }

      const projectIds = (
        await prisma.project.findMany({
          where: {
            academicPeriodId: periodId,
          },
          select: {
            id: true,
          },
        })
      ).map((item) => item.id)

      const [eventsDeleted, milestonesDeleted, requestsDeleted, projectsDeleted] = await prisma.$transaction([
        prisma.timelineRescheduleEvent.deleteMany({
          where: {
            projectId: {
              in: projectIds,
            },
          },
        }),
        prisma.milestone.deleteMany({
          where: {
            projectId: {
              in: projectIds,
            },
          },
        }),
        prisma.supervisionRequest.deleteMany({
          where: {
            OR: [
              {
                academicPeriodId: periodId,
              },
              {
                projectId: {
                  in: projectIds,
                },
              },
            ],
          },
        }),
        prisma.project.deleteMany({
          where: {
            id: {
              in: projectIds,
            },
          },
        }),
      ])

      await prisma.academicPeriod.delete({
        where: { id: periodId },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.delete_academic_period",
        resource: "academic_period",
        resourceId: periodId,
        metadata: {
          periodName: period.name,
          reason,
          deleted: {
            events: eventsDeleted.count,
            milestones: milestonesDeleted.count,
            requests: requestsDeleted.count,
            projects: projectsDeleted.count,
          },
        },
      })

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          periodDeleteResult: {
            deletedProjects: projectsDeleted.count,
            deletedMilestones: milestonesDeleted.count,
            deletedRequests: requestsDeleted.count,
            deletedRescheduleEvents: eventsDeleted.count,
          },
        },
        { status: 200 }
      )
    }

    if (action === "force_logout_all_users") {
      const confirmPhrase =
        typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : ""
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""

      if (confirmPhrase !== "LOGOUT ALL") {
        return NextResponse.json(
          { error: 'Type LOGOUT ALL in the confirmation field to continue.' },
          { status: 400 }
        )
      }
      if (!reason) {
        return NextResponse.json({ error: "Reason is required" }, { status: 400 })
      }

      const updated = await prisma.user.updateMany({
        where: {
          id: {
            not: auth.payload.sub,
          },
        },
        data: {
          sessionVersion: {
            increment: 1,
          },
        },
      })

      await prisma.impersonationSession.updateMany({
        where: {
          endedAt: null,
        },
        data: {
          endedAt: new Date(),
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.force_logout_all_users",
        resource: "sessions",
        metadata: {
          affectedUsers: updated.count,
          reason,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          forcedLogoutResult: {
            affectedUsers: updated.count,
          },
        },
        { status: 200 }
      )
    }

    if (action === "factory_reset") {
      const confirmPhrase =
        typeof body.confirmPhrase === "string" ? body.confirmPhrase.trim() : ""
      const reason = typeof body.reason === "string" ? body.reason.trim() : ""

      if (confirmPhrase !== "FACTORY RESET") {
        return NextResponse.json(
          { error: 'Type FACTORY RESET in the confirmation field to continue.' },
          { status: 400 }
        )
      }
      if (!reason) {
        return NextResponse.json({ error: "Reset reason is required" }, { status: 400 })
      }

      await prisma.$transaction(async (tx) => {
        const dbTx = tx as any
        await dbTx.rolePermission.deleteMany()
        await dbTx.userCustomRole.deleteMany()
        await dbTx.matchRecommendation.deleteMany()
        await dbTx.matchingBlacklist.deleteMany()
        await dbTx.timelineRescheduleEvent.deleteMany()
        await dbTx.notification.deleteMany()
        await dbTx.message.deleteMany()
        await dbTx.meeting.deleteMany()
        await dbTx.supervisionRequest.deleteMany()
        await dbTx.milestone.deleteMany()
        await dbTx.project.deleteMany()
        await dbTx.studentProfile.deleteMany()
        await dbTx.supervisorProfile.deleteMany()
        await dbTx.announcement.deleteMany()
        await dbTx.emailTemplate.deleteMany()
        await dbTx.serviceHealthSnapshot.deleteMany()
        await dbTx.serviceIncident.deleteMany()
        await dbTx.maintenanceWindow.deleteMany()
        await dbTx.impersonationSession.deleteMany()
        await dbTx.auditLog.deleteMany()
        await dbTx.customRole.deleteMany()
        await dbTx.permission.deleteMany()
        await dbTx.matchingConfig.deleteMany()
        await dbTx.requestOversightConfig.deleteMany()
        await dbTx.academicPeriod.deleteMany()
        await dbTx.systemHealthConfig.deleteMany()
        await dbTx.systemHealthSignal.deleteMany()
        await dbTx.dataImportJob.deleteMany()

        await dbTx.user.deleteMany({
          where: {
            id: {
              not: auth.payload.sub,
            },
          },
        })

        await dbTx.dataManagementConfig.upsert({
          where: { id: "global" },
          update: {
            autoBackupEnabled: true,
            backupFrequency: "DAILY",
            backupRetentionDays: 30,
            piiMaskBackups: true,
            completedProjectRetentionDays: 365,
            messageRetentionDays: 365,
            auditLogRetentionDays: 730,
          },
          create: {
            id: "global",
            autoBackupEnabled: true,
            backupFrequency: "DAILY",
            backupRetentionDays: 30,
            piiMaskBackups: true,
            completedProjectRetentionDays: 365,
            messageRetentionDays: 365,
            auditLogRetentionDays: 730,
          },
        })
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "data_management.factory_reset",
        resource: "platform",
        metadata: {
          reason,
          preservedAdminId: auth.payload.sub,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(payload, { status: 200 })
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Data management action failed" }, { status: 500 })
  }
}
