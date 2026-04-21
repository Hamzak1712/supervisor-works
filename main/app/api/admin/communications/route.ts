import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"

const db = prisma as any

const ANNOUNCEMENT_SEVERITIES = ["INFO", "WARNING", "CRITICAL"] as const
type AnnouncementSeverityValue = (typeof ANNOUNCEMENT_SEVERITIES)[number]

const ANNOUNCEMENT_AUDIENCES = [
  "ALL",
  "STUDENTS",
  "SUPERVISORS",
  "YEAR_GROUP",
] as const
type AnnouncementAudienceValue = (typeof ANNOUNCEMENT_AUDIENCES)[number]

const BROADCAST_AUDIENCES = [
  "all",
  "students",
  "supervisors",
  "year_group",
  "students_without_supervisor",
] as const
type BroadcastAudience = (typeof BROADCAST_AUDIENCES)[number]

type TemplateSeed = {
  key: string
  name: string
  subject: string
  body: string
}

type AudienceSummaryUser = {
  id: string
  role: string
  status: string
  studentProfile: {
    supervisorId: string | null
  } | null
}

type YearGroupRow = {
  name: string
}

type AnnouncementRow = {
  id: string
  title: string
  body: string
  severity: AnnouncementSeverityValue
  audience: AnnouncementAudienceValue
  audienceYearGroup: string | null
  startsAt: Date
  expiresAt: Date | null
  createdAt: Date
  updatedAt: Date
  createdBy: {
    email: string
  }
}

type EmailTemplateRow = {
  id: string
  key: string
  name: string
  subject: string
  body: string
  updatedAt: Date
}

const DEFAULT_TEMPLATES: TemplateSeed[] = [
  {
    key: "invite",
    name: "Invite User",
    subject: "You have been invited to SupervisorMatch",
    body: "An administrator invited you to join SupervisorMatch. Please use your temporary password to sign in.",
  },
  {
    key: "password_reset",
    name: "Password Reset",
    subject: "Your password has been reset",
    body: "An administrator reset your password. Sign in with your temporary password and change it immediately.",
  },
  {
    key: "request_received",
    name: "Request Received",
    subject: "New supervision request received",
    body: "You received a new supervision request. Open your dashboard to review and respond.",
  },
  {
    key: "request_accepted",
    name: "Request Accepted",
    subject: "Your supervision request was accepted",
    body: "A supervisor accepted your request and has been assigned to your project.",
  },
  {
    key: "milestone_overdue",
    name: "Milestone Overdue",
    subject: "A milestone is overdue",
    body: "One of your project milestones is overdue. Please review your timeline and update your plan.",
  },
  {
    key: "announcement_published",
    name: "Announcement Published",
    subject: "New platform announcement",
    body: "A new platform announcement has been published. Check your dashboard banner for details.",
  },
]

async function requireAdmin(req: Request, permissionKey: string) {
  const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

  if (!payload) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (!requireRole(payload, "ADMIN")) {
    const permitted = await hasPermission(payload, permissionKey)
    if (permitted) {
      return { ok: true as const, payload }
    }

    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { ok: true as const, payload }
}

function parseSeverity(input: unknown): AnnouncementSeverityValue | null {
  if (typeof input !== "string") return null
  const normalized = input.trim().toUpperCase()
  return ANNOUNCEMENT_SEVERITIES.find((value) => value === normalized) || null
}

function parseAudience(input: unknown): AnnouncementAudienceValue | null {
  if (typeof input !== "string") return null
  const normalized = input.trim().toUpperCase()
  return ANNOUNCEMENT_AUDIENCES.find((value) => value === normalized) || null
}

function parseDateInput(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

async function ensureTemplates() {
  const existing = (await db.emailTemplate.findMany({
    select: { key: true },
  })) as Array<{ key: string }>

  const existingKeys = new Set(existing.map((item) => item.key))
  const missing = DEFAULT_TEMPLATES.filter((item) => !existingKeys.has(item.key))

  if (missing.length > 0) {
    await db.emailTemplate.createMany({
      data: missing,
      skipDuplicates: true,
    })
  }
}

async function resolveBroadcastRecipients(input: {
  audience: BroadcastAudience
  yearGroup?: string | null
}) {
  if (input.audience === "all") {
    return (await db.user.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    })) as Array<{ id: string }>
  }

  if (input.audience === "students") {
    return (await db.user.findMany({
      where: { role: "STUDENT", status: "ACTIVE" },
      select: { id: true },
    })) as Array<{ id: string }>
  }

  if (input.audience === "supervisors") {
    return (await db.user.findMany({
      where: { role: "SUPERVISOR", status: "ACTIVE" },
      select: { id: true },
    })) as Array<{ id: string }>
  }

  if (input.audience === "students_without_supervisor") {
    return (await db.user.findMany({
      where: {
        role: "STUDENT",
        status: "ACTIVE",
        studentProfile: {
          is: {
            supervisorId: null,
          },
        },
      },
      select: { id: true },
    })) as Array<{ id: string }>
  }

  const yearGroup = input.yearGroup?.trim()
  if (!yearGroup) {
    return [] as Array<{ id: string }>
  }

  return (await db.user.findMany({
    where: {
      role: "STUDENT",
      status: "ACTIVE",
      project: {
        is: {
          academicPeriod: {
            is: {
              name: {
                equals: yearGroup,
                mode: "insensitive",
              },
            },
          },
        },
      },
    },
    select: { id: true },
  })) as Array<{ id: string }>
}

async function getPayload() {
  await ensureTemplates()

  const [announcements, templates, users, yearGroups] = (await Promise.all([
    db.announcement.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        body: true,
        severity: true,
        audience: true,
        audienceYearGroup: true,
        startsAt: true,
        expiresAt: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: {
            email: true,
          },
        },
      },
    }),
    db.emailTemplate.findMany({
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        key: true,
        name: true,
        subject: true,
        body: true,
        updatedAt: true,
      },
    }),
    db.user.findMany({
      select: {
        id: true,
        role: true,
        status: true,
        studentProfile: {
          select: {
            supervisorId: true,
          },
        },
      },
    }),
    db.academicPeriod.findMany({
      orderBy: {
        startDate: "desc",
      },
      select: {
        name: true,
      },
    }),
  ])) as [
    AnnouncementRow[],
    EmailTemplateRow[],
    AudienceSummaryUser[],
    YearGroupRow[],
  ]

  const nowMs = Date.now()

  const totalUsers = users.filter((user) => user.status === "ACTIVE").length
  const students = users.filter(
    (user) => user.role === "STUDENT" && user.status === "ACTIVE"
  ).length
  const supervisors = users.filter(
    (user) => user.role === "SUPERVISOR" && user.status === "ACTIVE"
  ).length
  const studentsWithoutSupervisor = users.filter(
    (user) =>
      user.role === "STUDENT" &&
      user.status === "ACTIVE" &&
      !user.studentProfile?.supervisorId
  ).length

  return {
    announcements: announcements.map((item) => {
      const startsMs = item.startsAt.getTime()
      const expiresMs = item.expiresAt ? item.expiresAt.getTime() : null
      const lifecycle =
        startsMs > nowMs
          ? "scheduled"
          : expiresMs !== null && expiresMs <= nowMs
            ? "expired"
            : "active"

      return {
        ...item,
        lifecycle,
        createdByEmail: item.createdBy.email,
      }
    }),
    templates,
    audienceSummary: {
      totalUsers,
      students,
      supervisors,
      studentsWithoutSupervisor,
    },
    yearGroups: Array.from(new Set(yearGroups.map((item) => item.name))).filter(Boolean),
    generatedAt: new Date().toISOString(),
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req, "admin.communications.manage")
    if (!auth.ok) return auth.response

    const payload = await getPayload()
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin(req, "admin.communications.manage")
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.trim() : ""
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    if (action === "create_announcement") {
      const title = typeof body.title === "string" ? body.title.trim() : ""
      const message = typeof body.message === "string" ? body.message.trim() : ""
      const severity = parseSeverity(body.severity)
      const audience = parseAudience(body.audience)
      const audienceYearGroup =
        typeof body.audienceYearGroup === "string"
          ? body.audienceYearGroup.trim()
          : ""
      const startsAt = parseDateInput(body.startsAt) || new Date()
      const expiresAt = parseDateInput(body.expiresAt)

      if (!title || !message) {
        return NextResponse.json(
          { error: "title and message are required" },
          { status: 400 }
        )
      }

      if (!severity) {
        return NextResponse.json(
          { error: "severity must be INFO, WARNING, or CRITICAL" },
          { status: 400 }
        )
      }

      if (!audience) {
        return NextResponse.json(
          { error: "audience must be ALL, STUDENTS, SUPERVISORS, or YEAR_GROUP" },
          { status: 400 }
        )
      }

      if (audience === "YEAR_GROUP" && !audienceYearGroup) {
        return NextResponse.json(
          { error: "audienceYearGroup is required when audience is YEAR_GROUP" },
          { status: 400 }
        )
      }

      if (expiresAt && expiresAt <= startsAt) {
        return NextResponse.json(
          { error: "expiresAt must be after startsAt" },
          { status: 400 }
        )
      }

      const announcement = (await db.announcement.create({
        data: {
          title,
          body: message,
          severity,
          audience,
          audienceYearGroup: audience === "YEAR_GROUP" ? audienceYearGroup : null,
          startsAt,
          expiresAt,
          createdById: auth.payload.sub,
        },
        select: { id: true, startsAt: true },
      })) as { id: string; startsAt: Date }

      const now = new Date()
      const isImmediatelyActive =
        announcement.startsAt <= now && (!expiresAt || expiresAt > now)

      if (isImmediatelyActive) {
        const template = (await db.emailTemplate.findUnique({
          where: { key: "announcement_published" },
          select: {
            subject: true,
            body: true,
          },
        })) as { subject: string; body: string } | null

        const recipients = await resolveBroadcastRecipients({
          audience:
            audience === "ALL"
              ? "all"
              : audience === "STUDENTS"
                ? "students"
                : audience === "SUPERVISORS"
                  ? "supervisors"
                  : "year_group",
          yearGroup: audienceYearGroup || null,
        })

        if (recipients.length > 0) {
          const bodyText = template?.body || "A new platform announcement was published."
          await db.notification.createMany({
            data: recipients.map((recipient) => ({
              userId: recipient.id,
              title: template?.subject || "New platform announcement",
              body: `${bodyText} ${title}`,
              type: "announcement",
            })),
          })
        }
      }

      const payload = await getPayload()
      return NextResponse.json(payload, { status: 200 })
    }

    if (action === "delete_announcement") {
      const announcementId =
        typeof body.announcementId === "string" ? body.announcementId.trim() : ""

      if (!announcementId) {
        return NextResponse.json(
          { error: "announcementId is required" },
          { status: 400 }
        )
      }

      await db.announcement.delete({
        where: {
          id: announcementId,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(payload, { status: 200 })
    }

    if (action === "update_template") {
      const key = typeof body.key === "string" ? body.key.trim() : ""
      const subject = typeof body.subject === "string" ? body.subject.trim() : ""
      const message = typeof body.body === "string" ? body.body.trim() : ""

      if (!key || !subject || !message) {
        return NextResponse.json(
          { error: "key, subject, and body are required" },
          { status: 400 }
        )
      }

      const fallbackName =
        DEFAULT_TEMPLATES.find((template) => template.key === key)?.name ||
        key.replaceAll("_", " ")

      await db.emailTemplate.upsert({
        where: { key },
        update: {
          subject,
          body: message,
          updatedById: auth.payload.sub,
        },
        create: {
          key,
          name: fallbackName,
          subject,
          body: message,
          updatedById: auth.payload.sub,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(payload, { status: 200 })
    }

    if (action === "broadcast_email") {
      const audienceRaw = typeof body.audience === "string" ? body.audience.trim() : ""
      const subject = typeof body.subject === "string" ? body.subject.trim() : ""
      const message = typeof body.message === "string" ? body.message.trim() : ""
      const yearGroup =
        typeof body.yearGroup === "string" ? body.yearGroup.trim() : ""

      const audience = BROADCAST_AUDIENCES.find((value) => value === audienceRaw)
      if (!audience) {
        return NextResponse.json(
          {
            error:
              "audience must be all, students, supervisors, year_group, or students_without_supervisor",
          },
          { status: 400 }
        )
      }

      if (!subject || !message) {
        return NextResponse.json(
          { error: "subject and message are required" },
          { status: 400 }
        )
      }

      if (audience === "year_group" && !yearGroup) {
        return NextResponse.json(
          { error: "yearGroup is required for year_group audience" },
          { status: 400 }
        )
      }

      const recipients = await resolveBroadcastRecipients({
        audience,
        yearGroup,
      })

      if (recipients.length > 0) {
        await db.notification.createMany({
          data: recipients.map((recipient) => ({
            userId: recipient.id,
            title: subject,
            body: message,
            type: "admin_broadcast",
          })),
        })
      }

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          actionResult: {
            sentCount: recipients.length,
            audience,
          },
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
