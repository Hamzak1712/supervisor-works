import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { logAudit } from "@/lib/audit"

function parseDateRange(req: Request) {
  const { searchParams } = new URL(req.url)
  const fromRaw = searchParams.get("from")
  const toRaw = searchParams.get("to")

  const now = new Date()
  const defaultFrom = new Date(now)
  defaultFrom.setDate(defaultFrom.getDate() - 30)
  defaultFrom.setHours(0, 0, 0, 0)

  const from = fromRaw ? new Date(fromRaw) : defaultFrom
  const to = toRaw ? new Date(toRaw) : now

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new Error("Invalid from/to date values")
  }

  const fromStart = new Date(from)
  fromStart.setHours(0, 0, 0, 0)
  const toEnd = new Date(to)
  toEnd.setHours(23, 59, 59, 999)

  if (fromStart > toEnd) {
    throw new Error("from must be on or before to")
  }

  return { from: fromStart, to: toEnd }
}

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10)
}

function toCsvRows(rows: Array<Array<string | number>>) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const str = `${value}`
          return `"${str.replace(/"/g, '""')}"`
        })
        .join(",")
    )
    .join("\n")
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
    const permitted = await hasPermission(payload, "admin.reports.read")
    if (!permitted) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }
    }
  }

  return { ok: true as const, payload }
}

async function buildPayload(from: Date, to: Date) {
  const [requests, supervisors, projects, events, messages, meetings, notifications, completedMilestones] =
    await Promise.all([
      prisma.supervisionRequest.findMany({
        where: {
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        select: {
          id: true,
          studentId: true,
          supervisorId: true,
          status: true,
          createdAt: true,
          respondedAt: true,
        },
      }),
      prisma.user.findMany({
        where: {
          role: "SUPERVISOR",
        },
        select: {
          id: true,
          email: true,
          supervisorProfile: {
            select: {
              fullName: true,
              maxCapacity: true,
            },
          },
          _count: {
            select: {
              assignedStudents: true,
            },
          },
        },
      }),
      prisma.project.findMany({
        where: {
          OR: [
            {
              createdAt: {
                gte: from,
                lte: to,
              },
            },
            {
              updatedAt: {
                gte: from,
                lte: to,
              },
            },
          ],
        },
        select: {
          id: true,
          status: true,
          academicPeriod: {
            select: {
              name: true,
            },
          },
          milestones: {
            select: {
              status: true,
              dueDate: true,
            },
          },
        },
      }),
      prisma.timelineRescheduleEvent.findMany({
        where: {
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        select: {
          id: true,
          projectId: true,
          shiftDaysApplied: true,
          rescheduledCount: true,
          triggeredByUserId: true,
          createdAt: true,
          project: {
            select: {
              academicPeriod: {
                select: {
                  name: true,
                },
              },
              studentId: true,
            },
          },
        },
      }),
      prisma.message.findMany({
        where: {
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        select: {
          senderId: true,
          receiverId: true,
          createdAt: true,
        },
      }),
      prisma.meeting.findMany({
        where: {
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        select: {
          organizerId: true,
          attendeeId: true,
          createdAt: true,
        },
      }),
      prisma.notification.findMany({
        where: {
          createdAt: {
            gte: from,
            lte: to,
          },
        },
        select: {
          userId: true,
          createdAt: true,
        },
      }),
      prisma.milestone.findMany({
        where: {
          completedDate: {
            gte: from,
            lte: to,
          },
        },
        select: {
          project: {
            select: {
              studentId: true,
            },
          },
          completedDate: true,
        },
      }),
    ])

  const totalRequests = requests.length
  const requestingStudents = new Set(requests.map((item) => item.studentId))
  const accepted = requests.filter((item) => item.status === "accepted")
  const declined = requests.filter((item) => item.status === "declined")
  const responded = accepted.length + declined.length
  const matchedWithin7Days = new Set(
    accepted
      .filter((item) => {
        if (!item.respondedAt) return false
        const days = (item.respondedAt.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        return days <= 7
      })
      .map((item) => item.studentId)
  )

  const matching = {
    studentsWithRequests: requestingStudents.size,
    matchedWithin7Days: matchedWithin7Days.size,
    matchedWithin7DaysRate:
      requestingStudents.size > 0
        ? Number(((matchedWithin7Days.size / requestingStudents.size) * 100).toFixed(2))
        : 0,
    averageRequestsPerStudent:
      requestingStudents.size > 0
        ? Number((totalRequests / requestingStudents.size).toFixed(2))
        : 0,
    declineRate: responded > 0 ? Number(((declined.length / responded) * 100).toFixed(2)) : 0,
    totalRequests,
    accepted: accepted.length,
    declined: declined.length,
    pendingOrOther: Math.max(0, totalRequests - responded),
  }

  const responsesBySupervisor = new Map<string, number[]>()
  requests.forEach((item) => {
    if (!item.respondedAt || (item.status !== "accepted" && item.status !== "declined")) return
    const days = (item.respondedAt.getTime() - item.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    const existing = responsesBySupervisor.get(item.supervisorId) || []
    existing.push(days)
    responsesBySupervisor.set(item.supervisorId, existing)
  })

  const workloadRows = supervisors.map((item) => {
    const assignedStudents = item._count.assignedStudents
    const capacity = item.supervisorProfile?.maxCapacity || 0
    const utilization = capacity > 0 ? (assignedStudents / capacity) * 100 : 0
    const responseTimes = responsesBySupervisor.get(item.id) || []
    const avgResponseDays =
      responseTimes.length > 0
        ? Number((responseTimes.reduce((sum, days) => sum + days, 0) / responseTimes.length).toFixed(2))
        : null
    return {
      supervisorId: item.id,
      supervisorName: item.supervisorProfile?.fullName || item.email,
      assignedStudents,
      maxCapacity: capacity,
      utilizationPercent: Number(utilization.toFixed(2)),
      isOverloaded: capacity > 0 ? assignedStudents > capacity : false,
      isUnderLoaded: capacity > 0 ? assignedStudents < Math.max(1, Math.floor(capacity * 0.5)) : false,
      avgResponseDays,
      responseSlaBreached: avgResponseDays !== null ? avgResponseDays > 7 : false,
    }
  })

  const workload = {
    totalSupervisors: workloadRows.length,
    overloaded: workloadRows.filter((item) => item.isOverloaded).length,
    underLoaded: workloadRows.filter((item) => item.isUnderLoaded).length,
    averageStudentsPerSupervisor:
      workloadRows.length > 0
        ? Number(
            (
              workloadRows.reduce((sum, item) => sum + item.assignedStudents, 0) / workloadRows.length
            ).toFixed(2)
          )
        : 0,
    rows: workloadRows,
  }

  const now = new Date()
  const projectByPeriod = new Map<string, { atRisk: number; onTrack: number; completed: number }>()

  projects.forEach((project) => {
    const periodName = project.academicPeriod?.name || "Unassigned period"
    const bucket = projectByPeriod.get(periodName) || { atRisk: 0, onTrack: 0, completed: 0 }

    const completedProject = ["completed", "submitted"].includes(project.status)
    const hasDelayed = project.milestones.some((milestone) => milestone.status === "delayed")
    const hasOverduePending = project.milestones.some(
      (milestone) =>
        (milestone.status === "pending" || milestone.status === "in_progress") &&
        new Date(milestone.dueDate) < now
    )

    if (completedProject) bucket.completed += 1
    else if (hasDelayed || hasOverduePending || ["abandoned", "withdrawn"].includes(project.status)) bucket.atRisk += 1
    else bucket.onTrack += 1

    projectByPeriod.set(periodName, bucket)
  })

  const projectHealthRows = Array.from(projectByPeriod.entries()).map(([periodName, value]) => ({
    periodName,
    ...value,
  }))

  const projectHealthTotals = projectHealthRows.reduce(
    (acc, row) => {
      acc.atRisk += row.atRisk
      acc.onTrack += row.onTrack
      acc.completed += row.completed
      return acc
    },
    { atRisk: 0, onTrack: 0, completed: 0 }
  )

  const reschedulingByPeriod = new Map<string, { count: number; sumShift: number; sumTouched: number }>()
  events.forEach((event) => {
    const periodName = event.project?.academicPeriod?.name || "Unassigned period"
    const current = reschedulingByPeriod.get(periodName) || { count: 0, sumShift: 0, sumTouched: 0 }
    current.count += 1
    current.sumShift += event.shiftDaysApplied
    current.sumTouched += event.rescheduledCount
    reschedulingByPeriod.set(periodName, current)
  })

  const reschedulingRows = Array.from(reschedulingByPeriod.entries()).map(([periodName, row]) => ({
    periodName,
    shifts: row.count,
    averageShiftDays: row.count > 0 ? Number((row.sumShift / row.count).toFixed(2)) : 0,
    averageMilestonesTouched: row.count > 0 ? Number((row.sumTouched / row.count).toFixed(2)) : 0,
  }))

  const rescheduling = {
    totalShifts: events.length,
    averageShiftDays:
      events.length > 0
        ? Number((events.reduce((sum, item) => sum + item.shiftDaysApplied, 0) / events.length).toFixed(2))
        : 0,
    averageMilestonesTouched:
      events.length > 0
        ? Number((events.reduce((sum, item) => sum + item.rescheduledCount, 0) / events.length).toFixed(2))
        : 0,
    rows: reschedulingRows,
  }

  const daySets = new Map<string, Set<string>>()
  const unionActiveUsers = new Set<string>()

  function mark(date: Date, userId: string) {
    const key = dayKey(date)
    const set = daySets.get(key) || new Set<string>()
    set.add(userId)
    daySets.set(key, set)
    unionActiveUsers.add(userId)
  }

  requests.forEach((item) => {
    mark(item.createdAt, item.studentId)
    mark(item.createdAt, item.supervisorId)
  })
  messages.forEach((item) => {
    mark(item.createdAt, item.senderId)
    mark(item.createdAt, item.receiverId)
  })
  meetings.forEach((item) => {
    mark(item.createdAt, item.organizerId)
    mark(item.createdAt, item.attendeeId)
  })
  notifications.forEach((item) => {
    mark(item.createdAt, item.userId)
  })
  completedMilestones.forEach((item) => {
    mark(item.completedDate || from, item.project.studentId)
  })
  events.forEach((item) => {
    if (item.triggeredByUserId) mark(item.createdAt, item.triggeredByUserId)
    if (item.project?.studentId) mark(item.createdAt, item.project.studentId)
  })

  const totalDays = Math.max(1, Math.ceil((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1)
  const averageDau =
    daySets.size > 0
      ? Number(
          (
            Array.from(daySets.values()).reduce((sum, set) => sum + set.size, 0) / totalDays
          ).toFixed(2)
        )
      : 0

  const mau = unionActiveUsers.size

  const engagement = {
    activeUsers: unionActiveUsers.size,
    averageDau,
    mau,
    dauMauRatio: mau > 0 ? Number(((averageDau / mau) * 100).toFixed(2)) : 0,
    dailyActivity: Array.from(daySets.entries())
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([date, users]) => ({ date, activeUsers: users.size })),
    featureUsage: [
      { feature: "supervision_requests", count: requests.length },
      { feature: "messages", count: messages.length },
      { feature: "meetings", count: meetings.length },
      { feature: "notifications", count: notifications.length },
      { feature: "reschedules", count: events.length },
      { feature: "milestone_completions", count: completedMilestones.length },
    ],
  }

  return {
    range: {
      from: from.toISOString(),
      to: to.toISOString(),
    },
    matching,
    supervisorWorkload: workload,
    projectHealth: {
      totals: projectHealthTotals,
      rows: projectHealthRows,
    },
    rescheduling,
    engagement,
    generatedAt: new Date().toISOString(),
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const { from, to } = parseDateRange(req)
    const payload = await buildPayload(from, to)
    const { searchParams } = new URL(req.url)
    const exportFormat = searchParams.get("export")?.trim().toLowerCase()

    await logAudit({
      actorId: auth.payload.sub,
      actorEmail: auth.payload.email,
      actorRole: auth.payload.role,
      action: "reports.view",
      resource: "admin_reports",
      metadata: {
        from: payload.range.from,
        to: payload.range.to,
        export: exportFormat || "none",
      },
    })

    if (exportFormat === "csv") {
      const rows: Array<Array<string | number>> = [
        ["section", "metric", "value"],
        ["matching", "studentsWithRequests", payload.matching.studentsWithRequests],
        ["matching", "matchedWithin7Days", payload.matching.matchedWithin7Days],
        ["matching", "matchedWithin7DaysRate", payload.matching.matchedWithin7DaysRate],
        ["matching", "averageRequestsPerStudent", payload.matching.averageRequestsPerStudent],
        ["matching", "declineRate", payload.matching.declineRate],
        ["workload", "totalSupervisors", payload.supervisorWorkload.totalSupervisors],
        ["workload", "overloaded", payload.supervisorWorkload.overloaded],
        ["workload", "underLoaded", payload.supervisorWorkload.underLoaded],
        ["projectHealth", "atRisk", payload.projectHealth.totals.atRisk],
        ["projectHealth", "onTrack", payload.projectHealth.totals.onTrack],
        ["projectHealth", "completed", payload.projectHealth.totals.completed],
        ["rescheduling", "totalShifts", payload.rescheduling.totalShifts],
        ["rescheduling", "averageShiftDays", payload.rescheduling.averageShiftDays],
        ["engagement", "activeUsers", payload.engagement.activeUsers],
        ["engagement", "averageDau", payload.engagement.averageDau],
        ["engagement", "mau", payload.engagement.mau],
        ["engagement", "dauMauRatio", payload.engagement.dauMauRatio],
      ]

      const csv = toCsvRows(rows)
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="analytics-report-${payload.range.from.slice(
            0,
            10
          )}-to-${payload.range.to.slice(0, 10)}.csv"`,
        },
      })
    }

    if (exportFormat === "json") {
      const content = JSON.stringify(payload, null, 2)
      return new NextResponse(content, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Content-Disposition": `attachment; filename="analytics-report-${payload.range.from.slice(
            0,
            10
          )}-to-${payload.range.to.slice(0, 10)}.json"`,
        },
      })
    }

    return NextResponse.json(payload, { status: 200 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 })
  }
}
