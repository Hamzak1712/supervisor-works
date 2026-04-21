import { NextResponse } from "next/server"
import { AccountStatus, Prisma, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"

async function requireAdmin(req: Request) {
  const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

  if (!payload) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (!requireRole(payload, "ADMIN")) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { ok: true as const, payload }
}

function splitCsv(value: string | null | undefined) {
  if (!value) return []
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function responseDays(createdAt: Date, respondedAt: Date | null) {
  if (!respondedAt) return null
  return (respondedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24)
}

async function getSupervisorManagementData() {
  const [supervisors, assignedStudents, allRequests, pendingApplications, students] =
    await prisma.$transaction([
      prisma.user.findMany({
        where: {
          role: Role.SUPERVISOR,
        },
        include: {
          supervisorProfile: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.studentProfile.findMany({
        select: {
          id: true,
          userId: true,
          fullName: true,
          supervisorId: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      }),
      prisma.supervisionRequest.findMany({
        where: {
          respondedAt: {
            not: null,
          },
        },
        select: {
          supervisorId: true,
          createdAt: true,
          respondedAt: true,
          status: true,
        },
      }),
      prisma.user.findMany({
        where: {
          role: Role.SUPERVISOR,
          status: AccountStatus.PENDING,
        },
        include: {
          supervisorProfile: true,
        },
        orderBy: {
          createdAt: "asc",
        },
      }),
      prisma.user.findMany({
        where: {
          role: Role.STUDENT,
        },
        include: {
          studentProfile: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ])

  const currentStudentsBySupervisor = new Map<string, number>()
  assignedStudents.forEach((student) => {
    if (!student.supervisorId) return
    currentStudentsBySupervisor.set(
      student.supervisorId,
      (currentStudentsBySupervisor.get(student.supervisorId) ?? 0) + 1
    )
  })

  const responsesBySupervisor = new Map<string, number[]>()
  const pendingRequestsBySupervisor = new Map<string, number>()

  allRequests.forEach((request) => {
    const days = responseDays(request.createdAt, request.respondedAt)
    if (days !== null) {
      const existing = responsesBySupervisor.get(request.supervisorId) ?? []
      existing.push(days)
      responsesBySupervisor.set(request.supervisorId, existing)
    }
  })

  const pendingRequests = await prisma.supervisionRequest.findMany({
    where: { status: "pending" },
    select: { supervisorId: true },
  })

  pendingRequests.forEach((item) => {
    pendingRequestsBySupervisor.set(
      item.supervisorId,
      (pendingRequestsBySupervisor.get(item.supervisorId) ?? 0) + 1
    )
  })

  const supervisorRows = supervisors.map((supervisor) => {
    const currentStudents =
      currentStudentsBySupervisor.get(supervisor.id) ?? 0
    const maxCapacity = supervisor.supervisorProfile?.maxCapacity ?? 5
    const responseDaysList = responsesBySupervisor.get(supervisor.id) ?? []
    const avgResponseDays =
      responseDaysList.length > 0
        ? responseDaysList.reduce((sum, value) => sum + value, 0) /
          responseDaysList.length
        : null
    const responseTimeFlag = avgResponseDays !== null && avgResponseDays > 7

    return {
      userId: supervisor.id,
      email: supervisor.email,
      status: supervisor.status,
      fullName:
        supervisor.supervisorProfile?.fullName ||
        supervisor.email.split("@")[0] ||
        "Unnamed Supervisor",
      expertise: splitCsv(supervisor.supervisorProfile?.expertise),
      maxCapacity,
      currentStudents,
      remainingSlots: Math.max(maxCapacity - currentStudents, 0),
      acceptingStudents:
        supervisor.supervisorProfile?.acceptingStudents ?? true,
      pendingRequests:
        pendingRequestsBySupervisor.get(supervisor.id) ?? 0,
      avgResponseDays,
      responseTimeFlag,
    }
  })

  const studentsForAssignment = students.map((student) => ({
    userId: student.id,
    email: student.email,
    fullName:
      student.studentProfile?.fullName ||
      student.email.split("@")[0] ||
      "Unnamed Student",
    supervisorId: student.studentProfile?.supervisorId ?? null,
  }))

  return {
    supervisors: supervisorRows,
    pendingApplications: pendingApplications.map((user) => ({
      userId: user.id,
      email: user.email,
      fullName:
        user.supervisorProfile?.fullName ||
        user.email.split("@")[0] ||
        "Unnamed Supervisor",
      createdAt: user.createdAt,
    })),
    students: studentsForAssignment,
    summary: {
      totalSupervisors: supervisorRows.length,
      acceptingSupervisors: supervisorRows.filter((s) => s.acceptingStudents).length,
      pausedIntake: supervisorRows.filter((s) => !s.acceptingStudents).length,
      flaggedResponseTime: supervisorRows.filter((s) => s.responseTimeFlag).length,
      totalCapacity: supervisorRows.reduce((sum, s) => sum + s.maxCapacity, 0),
      totalAssigned: supervisorRows.reduce((sum, s) => sum + s.currentStudents, 0),
    },
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const data = await getSupervisorManagementData()
    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
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

    const action = typeof body.action === "string" ? body.action.trim() : ""

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    if (action === "update_capacity") {
      const supervisorId =
        typeof body.supervisorId === "string" ? body.supervisorId.trim() : ""
      const maxCapacity =
        typeof body.maxCapacity === "number"
          ? Math.floor(body.maxCapacity)
          : Number.NaN

      if (!supervisorId || !Number.isFinite(maxCapacity)) {
        return NextResponse.json(
          { error: "supervisorId and maxCapacity are required" },
          { status: 400 }
        )
      }

      const assignedCount = await prisma.studentProfile.count({
        where: { supervisorId },
      })

      if (maxCapacity < assignedCount) {
        return NextResponse.json(
          {
            error: `maxCapacity cannot be lower than currently assigned students (${assignedCount})`,
          },
          { status: 400 }
        )
      }

      await prisma.supervisorProfile.update({
        where: { userId: supervisorId },
        data: { maxCapacity },
      })
    } else if (action === "set_intake") {
      const supervisorId =
        typeof body.supervisorId === "string" ? body.supervisorId.trim() : ""
      const acceptingStudents = Boolean(body.acceptingStudents)

      if (!supervisorId) {
        return NextResponse.json(
          { error: "supervisorId is required" },
          { status: 400 }
        )
      }

      await prisma.supervisorProfile.update({
        where: { userId: supervisorId },
        data: { acceptingStudents },
      })

      await prisma.notification.create({
        data: {
          userId: supervisorId,
          title: acceptingStudents ? "Intake resumed" : "Intake paused",
          body: acceptingStudents
            ? "An admin resumed your supervisor intake. You can receive new supervision requests."
            : "An admin paused your supervisor intake. You will not receive new supervision requests.",
          type: "supervisor_intake",
        },
      })
    } else if (action === "assign_student") {
      const studentId =
        typeof body.studentId === "string" ? body.studentId.trim() : ""
      const toSupervisorId =
        typeof body.toSupervisorId === "string"
          ? body.toSupervisorId.trim()
          : ""

      if (!studentId || !toSupervisorId) {
        return NextResponse.json(
          { error: "studentId and toSupervisorId are required" },
          { status: 400 }
        )
      }

      const supervisor = await prisma.user.findUnique({
        where: { id: toSupervisorId },
        select: {
          id: true,
          role: true,
          status: true,
          supervisorProfile: {
            select: {
              fullName: true,
            },
          },
        },
      })

      if (
        !supervisor ||
        supervisor.role !== Role.SUPERVISOR ||
        supervisor.status !== AccountStatus.ACTIVE
      ) {
        return NextResponse.json(
          { error: "Target supervisor must be an active supervisor" },
          { status: 400 }
        )
      }

      const updatedStudent = await prisma.studentProfile.update({
        where: { userId: studentId },
        data: { supervisorId: toSupervisorId },
        select: {
          userId: true,
          fullName: true,
          user: {
            select: {
              email: true,
            },
          },
        },
      })

      await prisma.notification.create({
        data: {
          userId: studentId,
          title: "Supervisor assignment updated",
          body: `Your supervisor assignment has been updated to ${supervisor.supervisorProfile?.fullName || "a supervisor"}.`,
          type: "supervisor_assignment",
        },
      })

      await prisma.notification.create({
        data: {
          userId: toSupervisorId,
          title: "Student assigned",
          body: `An admin assigned ${updatedStudent.fullName || updatedStudent.user.email} to you.`,
          type: "supervisor_assignment",
        },
      })
    } else if (action === "reassign_all_students") {
      const fromSupervisorId =
        typeof body.fromSupervisorId === "string"
          ? body.fromSupervisorId.trim()
          : ""
      const toSupervisorId =
        typeof body.toSupervisorId === "string"
          ? body.toSupervisorId.trim()
          : ""

      if (!fromSupervisorId || !toSupervisorId) {
        return NextResponse.json(
          { error: "fromSupervisorId and toSupervisorId are required" },
          { status: 400 }
        )
      }

      if (fromSupervisorId === toSupervisorId) {
        return NextResponse.json(
          { error: "fromSupervisorId and toSupervisorId must be different" },
          { status: 400 }
        )
      }

      const movedStudents = await prisma.studentProfile.findMany({
        where: { supervisorId: fromSupervisorId },
        select: { userId: true, fullName: true, user: { select: { email: true } } },
      })

      await prisma.studentProfile.updateMany({
        where: { supervisorId: fromSupervisorId },
        data: { supervisorId: toSupervisorId },
      })

      if (movedStudents.length > 0) {
        await prisma.notification.createMany({
          data: movedStudents.map((student) => ({
            userId: student.userId,
            title: "Supervisor reassigned",
            body: "Your supervisor was reassigned by an administrator.",
            type: "supervisor_assignment",
          })),
        })
      }
    } else if (action === "send_workload_nudge") {
      const userIds = Array.isArray(body.supervisorIds)
        ? body.supervisorIds.filter(
            (id: unknown): id is string =>
              typeof id === "string" && id.trim().length > 0
          )
        : []

      const scopedWhere: Prisma.UserWhereInput = {
        role: Role.SUPERVISOR,
      }

      if (userIds.length > 0) {
        scopedWhere.id = {
          in: Array.from(new Set(userIds.map((id: string) => id.trim()))),
        }
      }

      const supervisors = await prisma.user.findMany({
        where: scopedWhere,
        select: {
          id: true,
          supervisorProfile: {
            select: {
              maxCapacity: true,
            },
          },
          assignedStudents: {
            select: {
              id: true,
            },
          },
        },
      })

      const notifications = supervisors.map((supervisor) => {
        const maxCapacity = supervisor.supervisorProfile?.maxCapacity ?? 5
        const currentLoad = supervisor.assignedStudents.length
        const ratio = maxCapacity > 0 ? currentLoad / maxCapacity : 1

        if (ratio >= 0.9) {
          return {
            userId: supervisor.id,
            title: "Workload balancing nudge",
            body: "Your load is high. Consider pausing intake or requesting capacity support.",
            type: "workload_nudge",
          }
        }

        return {
          userId: supervisor.id,
          title: "Workload balancing nudge",
          body: "You appear under-loaded. Please review pending requests and accept where possible.",
          type: "workload_nudge",
        }
      })

      if (notifications.length > 0) {
        await prisma.notification.createMany({
          data: notifications,
        })
      }
    } else if (action === "approve_supervisor") {
      const userId =
        typeof body.userId === "string" ? body.userId.trim() : ""
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 })
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          role: Role.SUPERVISOR,
          status: AccountStatus.ACTIVE,
          supervisorProfile: {
            upsert: {
              update: {
                acceptingStudents: true,
              },
              create: {
                acceptingStudents: true,
              },
            },
          },
          sessionVersion: {
            increment: 1,
          },
        },
      })

      await prisma.notification.create({
        data: {
          userId,
          title: "Supervisor application approved",
          body: "Your supervisor account has been approved and activated by an administrator.",
          type: "account_update",
        },
      })
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const data = await getSupervisorManagementData()
    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
