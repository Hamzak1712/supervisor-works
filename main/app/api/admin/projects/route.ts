import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import { autoArchiveCompletedAcademicPeriods } from "@/lib/academic-periods"
import { hasPermission } from "@/lib/rbac"

const MIN_DEPENDENCY_GAP_DAYS = 3
const MIN_BEFORE_CRITICAL_DAYS = 5

type ProjectPhase =
  | "planning"
  | "execution"
  | "finalization"
  | "completed"
  | "closed"

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

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

function parseOptionalBool(value: string | null) {
  if (value === null) return null
  const normalized = value.trim().toLowerCase()
  if (normalized === "true") return true
  if (normalized === "false") return false
  return null
}

function parseProjectStatus(value: unknown) {
  if (typeof value !== "string") return null
  const status = value.trim().toLowerCase()
  if (!status) return null
  if (
    ![
      "draft",
      "pending_supervisor",
      "active",
      "completed",
      "abandoned",
      "withdrawn",
      "submitted",
    ].includes(status)
  ) {
    return null
  }
  return status
}

function parseMilestoneStatus(value: unknown) {
  if (typeof value !== "string") return null
  const status = value.trim().toLowerCase()
  if (!status) return null
  if (!["pending", "in_progress", "completed", "delayed"].includes(status)) {
    return null
  }
  return status
}

function computePhase(params: {
  status: string
  completed: number
  total: number
}): ProjectPhase {
  if (params.status === "completed" || params.status === "submitted") {
    return "completed"
  }
  if (params.status === "abandoned" || params.status === "withdrawn") {
    return "closed"
  }

  if (params.total === 0) return "planning"

  const completionRatio = params.completed / params.total
  if (completionRatio < 0.34) return "planning"
  if (completionRatio < 0.8) return "execution"
  return "finalization"
}

function computeRisk(params: {
  delayedCount: number
  nextDueDate: Date | null
  status: string
}) {
  if (params.status === "completed" || params.status === "submitted") {
    return false
  }
  if (params.status === "abandoned" || params.status === "withdrawn") {
    return false
  }
  if (params.delayedCount > 0) return true
  if (!params.nextDueDate) return false
  const now = new Date()
  return params.nextDueDate < now
}

async function applyForceReschedule(input: {
  projectId: string
  shiftDaysRequested: number
  anchorMilestoneId?: string | null
  triggeredByUserId: string
}) {
  const project = await prisma.project.findUnique({
    where: { id: input.projectId },
    select: {
      id: true,
      timelineLocked: true,
      academicPeriod: {
        select: {
          projectEndPolicyAt: true,
          finalSubmissionAt: true,
        },
      },
      milestones: {
        where: {
          status: {
            not: "completed",
          },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          dueDate: true,
          isCriticalPath: true,
          status: true,
          createdAt: true,
        },
      },
    },
  })

  if (!project) {
    return { ok: false as const, error: "Project not found" }
  }

  if (project.timelineLocked) {
    return {
      ok: false as const,
      error: "Timeline is locked for this project and cannot be rescheduled.",
    }
  }

  if (project.milestones.length === 0) {
    return {
      ok: false as const,
      error: "No active milestones available for rescheduling.",
    }
  }

  const anchorIndex = input.anchorMilestoneId
    ? project.milestones.findIndex((item) => item.id === input.anchorMilestoneId)
    : 0

  if (anchorIndex < 0) {
    return {
      ok: false as const,
      error: "Anchor milestone not found in this project.",
    }
  }

  const anchor = project.milestones[anchorIndex]
  const hardEndDate =
    project.academicPeriod?.projectEndPolicyAt ||
    project.academicPeriod?.finalSubmissionAt ||
    null

  const shiftDaysApplied =
    Number.isFinite(input.shiftDaysRequested) && input.shiftDaysRequested > 0
      ? Math.min(60, Math.round(input.shiftDaysRequested))
      : 7

  const targetDueDate = addDays(new Date(anchor.dueDate), shiftDaysApplied)

  if (hardEndDate && targetDueDate > hardEndDate) {
    return {
      ok: false as const,
      error:
        `Reschedule refused: "${anchor.title}" would move beyond the period end-date policy (${hardEndDate.toLocaleDateString()}).`,
    }
  }

  const downstream = project.milestones.slice(anchorIndex + 1)
  const warnings: string[] = []
  const updates: Array<{ id: string; dueDate: Date }> = [{ id: anchor.id, dueDate: targetDueDate }]

  let previousScheduledDate = targetDueDate

  for (const item of downstream) {
    if (item.isCriticalPath) {
      const minimumForCritical = addDays(previousScheduledDate, MIN_BEFORE_CRITICAL_DAYS)
      if (new Date(item.dueDate) < minimumForCritical) {
        warnings.push(
          `Critical milestone "${item.title}" is now at-risk; manual intervention is recommended.`
        )
      }

      previousScheduledDate =
        new Date(item.dueDate) > previousScheduledDate
          ? new Date(item.dueDate)
          : previousScheduledDate
      continue
    }

    const shiftedDate = addDays(new Date(item.dueDate), shiftDaysApplied)
    const dependencyFloor = addDays(previousScheduledDate, MIN_DEPENDENCY_GAP_DAYS)
    const recalculatedDate =
      shiftedDate > dependencyFloor ? shiftedDate : dependencyFloor

    if (hardEndDate && recalculatedDate > hardEndDate) {
      return {
        ok: false as const,
        error:
          `Reschedule refused: downstream milestone "${item.title}" would move beyond the period end-date policy (${hardEndDate.toLocaleDateString()}).`,
      }
    }

    if (recalculatedDate.getTime() !== new Date(item.dueDate).getTime()) {
      updates.push({ id: item.id, dueDate: recalculatedDate })
    }

    previousScheduledDate = recalculatedDate
  }

  await prisma.$transaction([
    ...updates.map((item) =>
      prisma.milestone.update({
        where: { id: item.id },
        data: { dueDate: item.dueDate },
      })
    ),
    prisma.timelineRescheduleEvent.create({
      data: {
        projectId: project.id,
        triggerType: "admin_force",
        triggeredByUserId: input.triggeredByUserId,
        anchorMilestoneId: anchor.id,
        shiftDaysRequested: input.shiftDaysRequested,
        shiftDaysApplied,
        rescheduledCount: Math.max(0, updates.length - 1),
        warnings,
      },
    }),
  ])

  return {
    ok: true as const,
    data: {
      projectId: project.id,
      anchorMilestoneId: anchor.id,
      shiftDaysRequested: input.shiftDaysRequested,
      shiftDaysApplied,
      rescheduledCount: Math.max(0, updates.length - 1),
      warnings,
    },
  }
}

async function getPayload(params: {
  status: string | null
  supervisorId: string | null
  phase: string | null
  atRisk: boolean | null
  projectId: string | null
}) {
  await autoArchiveCompletedAcademicPeriods(prisma)

  const projects = await prisma.project.findMany({
    where: {
      ...(params.status ? { status: params.status } : {}),
      ...(params.supervisorId
        ? {
            student: {
              studentProfile: {
                is: {
                  supervisorId: params.supervisorId,
                },
              },
            },
          }
        : {}),
    },
    orderBy: [{ updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      timelineLocked: true,
      timelineLockedAt: true,
      timelineLockReason: true,
      createdAt: true,
      updatedAt: true,
      student: {
        select: {
          id: true,
          email: true,
          studentProfile: {
            select: {
              fullName: true,
              supervisorId: true,
              supervisor: {
                select: {
                  id: true,
                  email: true,
                  supervisorProfile: {
                    select: {
                      fullName: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
      milestones: {
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          dueDate: true,
          status: true,
          isCriticalPath: true,
        },
      },
    },
  })

  const mapped = projects.map((project) => {
    const completedCount = project.milestones.filter(
      (item) => item.status === "completed"
    ).length
    const inProgressCount = project.milestones.filter(
      (item) => item.status === "in_progress"
    ).length
    const delayedCount = project.milestones.filter(
      (item) => item.status === "delayed"
    ).length
    const nextDueDate =
      project.milestones.find((item) => item.status !== "completed")?.dueDate ||
      null

    const phase = computePhase({
      status: project.status,
      completed: completedCount,
      total: project.milestones.length,
    })
    const atRisk = computeRisk({
      delayedCount,
      nextDueDate,
      status: project.status,
    })

    return {
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      phase,
      atRisk,
      timelineLocked: project.timelineLocked,
      timelineLockedAt: project.timelineLockedAt,
      timelineLockReason: project.timelineLockReason,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      student: {
        id: project.student.id,
        email: project.student.email,
        fullName: project.student.studentProfile?.fullName || project.student.email,
      },
      supervisor: project.student.studentProfile?.supervisor
        ? {
            id: project.student.studentProfile.supervisor.id,
            email: project.student.studentProfile.supervisor.email,
            fullName:
              project.student.studentProfile.supervisor.supervisorProfile
                ?.fullName ||
              project.student.studentProfile.supervisor.email,
          }
        : null,
      stats: {
        totalMilestones: project.milestones.length,
        completedCount,
        inProgressCount,
        delayedCount,
        nextDueDate,
      },
    }
  })

  const filtered = mapped.filter((item) => {
    if (params.phase && item.phase !== params.phase) return false
    if (params.atRisk !== null && item.atRisk !== params.atRisk) return false
    return true
  })

  const supervisorsMap = new Map<string, { id: string; fullName: string; email: string }>()
  mapped.forEach((project) => {
    if (!project.supervisor) return
    supervisorsMap.set(project.supervisor.id, project.supervisor)
  })

  const selectedProjectId = params.projectId || filtered[0]?.id || null

  const selectedProject = selectedProjectId
    ? await prisma.project.findUnique({
        where: { id: selectedProjectId },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          timelineLocked: true,
          timelineLockedAt: true,
          timelineLockReason: true,
          createdAt: true,
          updatedAt: true,
          student: {
            select: {
              id: true,
              email: true,
              studentProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          milestones: {
            orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              projectId: true,
              title: true,
              description: true,
              dueDate: true,
              status: true,
              isCriticalPath: true,
              feedback: true,
              completedDate: true,
              createdAt: true,
              updatedAt: true,
            },
          },
          rescheduleEvents: {
            orderBy: [{ createdAt: "desc" }],
            take: 100,
            select: {
              id: true,
              triggerType: true,
              triggeredByUserId: true,
              anchorMilestoneId: true,
              shiftDaysRequested: true,
              shiftDaysApplied: true,
              rescheduledCount: true,
              warnings: true,
              createdAt: true,
            },
          },
        },
      })
    : null

  return {
    projects: filtered,
    supervisors: Array.from(supervisorsMap.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    ),
    selectedProject,
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req, "admin.projects.read")
    if (!auth.ok) return auth.response

    const { searchParams } = new URL(req.url)
    const status = searchParams.get("status")?.trim().toLowerCase() || null
    const supervisorId = searchParams.get("supervisorId")?.trim() || null
    const phase = searchParams.get("phase")?.trim().toLowerCase() || null
    const atRisk = parseOptionalBool(searchParams.get("atRisk"))
    const projectId = searchParams.get("projectId")?.trim() || null

    const data = await getPayload({
      status,
      supervisorId,
      phase,
      atRisk,
      projectId,
    })

    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin(req, "admin.projects.manage")
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.trim() : ""
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    let refreshProjectId: string | null = null

    if (action === "set_project_status") {
      const projectId =
        typeof body.projectId === "string" ? body.projectId.trim() : ""
      const status = parseProjectStatus(body.status)

      if (!projectId || !status) {
        return NextResponse.json(
          { error: "projectId and valid status are required" },
          { status: 400 }
        )
      }

      const lockTimeline = status === "completed" || status === "submitted"
      refreshProjectId = projectId

      await prisma.project.update({
        where: { id: projectId },
        data: {
          status,
          timelineLocked: lockTimeline,
          timelineLockedAt: lockTimeline ? new Date() : null,
          timelineLockReason: lockTimeline
            ? "Project marked submitted/completed by admin."
            : null,
        },
      })
    } else if (action === "set_timeline_lock") {
      const projectId =
        typeof body.projectId === "string" ? body.projectId.trim() : ""
      const locked = Boolean(body.locked)
      const reason =
        typeof body.reason === "string" ? body.reason.trim() || null : null

      if (!projectId) {
        return NextResponse.json({ error: "projectId is required" }, { status: 400 })
      }
      refreshProjectId = projectId

      await prisma.project.update({
        where: { id: projectId },
        data: {
          timelineLocked: locked,
          timelineLockedAt: locked ? new Date() : null,
          timelineLockReason: locked ? reason || "Locked by admin." : null,
        },
      })
    } else if (action === "add_milestone") {
      const projectId =
        typeof body.projectId === "string" ? body.projectId.trim() : ""
      const title = typeof body.title === "string" ? body.title.trim() : ""
      const description =
        typeof body.description === "string" ? body.description.trim() : null
      const status = parseMilestoneStatus(body.status) || "pending"
      const dueDateRaw = typeof body.dueDate === "string" ? body.dueDate.trim() : ""
      const isCriticalPath = Boolean(body.isCriticalPath)

      if (!projectId || !title || !dueDateRaw) {
        return NextResponse.json(
          { error: "projectId, title, and dueDate are required" },
          { status: 400 }
        )
      }

      const dueDate = new Date(dueDateRaw)
      if (Number.isNaN(dueDate.getTime())) {
        return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 })
      }

      const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { timelineLocked: true },
      })

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }
      refreshProjectId = projectId

      if (project.timelineLocked) {
        return NextResponse.json(
          { error: "Timeline is locked and cannot be edited." },
          { status: 400 }
        )
      }

      await prisma.milestone.create({
        data: {
          projectId,
          title,
          description,
          dueDate,
          status,
          isCriticalPath,
        },
      })
    } else if (action === "update_milestone") {
      const milestoneId =
        typeof body.milestoneId === "string" ? body.milestoneId.trim() : ""

      if (!milestoneId) {
        return NextResponse.json(
          { error: "milestoneId is required" },
          { status: 400 }
        )
      }

      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: {
          id: true,
          projectId: true,
          project: {
            select: {
              timelineLocked: true,
            },
          },
        },
      })

      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 })
      }
      refreshProjectId = milestone.projectId

      if (milestone.project.timelineLocked) {
        return NextResponse.json(
          { error: "Timeline is locked and cannot be edited." },
          { status: 400 }
        )
      }

      const title = typeof body.title === "string" ? body.title.trim() : undefined
      const description =
        typeof body.description === "string"
          ? body.description.trim()
          : body.description === null
            ? null
            : undefined
      const dueDate =
        typeof body.dueDate === "string" && body.dueDate.trim()
          ? new Date(body.dueDate.trim())
          : undefined
      const status =
        body.status === undefined ? undefined : parseMilestoneStatus(body.status)
      const isCriticalPath =
        typeof body.isCriticalPath === "boolean" ? body.isCriticalPath : undefined
      const feedback =
        typeof body.feedback === "string"
          ? body.feedback.trim()
          : body.feedback === null
            ? null
            : undefined

      if (dueDate && Number.isNaN(dueDate.getTime())) {
        return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 })
      }

      if (body.status !== undefined && !status) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }

      await prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(description !== undefined ? { description } : {}),
          ...(dueDate !== undefined ? { dueDate } : {}),
          ...(status !== undefined && status !== null ? { status } : {}),
          ...(isCriticalPath !== undefined ? { isCriticalPath } : {}),
          ...(feedback !== undefined ? { feedback } : {}),
          ...(status === "completed" ? { completedDate: new Date() } : {}),
          ...(status && status !== "completed" ? { completedDate: null } : {}),
        },
      })
    } else if (action === "delete_milestone") {
      const milestoneId =
        typeof body.milestoneId === "string" ? body.milestoneId.trim() : ""

      if (!milestoneId) {
        return NextResponse.json(
          { error: "milestoneId is required" },
          { status: 400 }
        )
      }

      const milestone = await prisma.milestone.findUnique({
        where: { id: milestoneId },
        select: {
          id: true,
          projectId: true,
          project: {
            select: {
              timelineLocked: true,
            },
          },
        },
      })

      if (!milestone) {
        return NextResponse.json({ error: "Milestone not found" }, { status: 404 })
      }
      refreshProjectId = milestone.projectId

      if (milestone.project.timelineLocked) {
        return NextResponse.json(
          { error: "Timeline is locked and cannot be edited." },
          { status: 400 }
        )
      }

      await prisma.milestone.delete({
        where: { id: milestoneId },
      })
    } else if (action === "force_reschedule") {
      const projectId =
        typeof body.projectId === "string" ? body.projectId.trim() : ""
      const shiftDaysRaw =
        typeof body.shiftDays === "number" ? body.shiftDays : Number(body.shiftDays)
      const anchorMilestoneId =
        typeof body.anchorMilestoneId === "string"
          ? body.anchorMilestoneId.trim()
          : null

      if (!projectId) {
        return NextResponse.json({ error: "projectId is required" }, { status: 400 })
      }
      refreshProjectId = projectId

      const shiftDaysRequested =
        Number.isFinite(shiftDaysRaw) && shiftDaysRaw > 0 ? shiftDaysRaw : 7

      const result = await applyForceReschedule({
        projectId,
        shiftDaysRequested,
        anchorMilestoneId,
        triggeredByUserId: auth.payload.sub,
      })

      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 })
      }
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const data = await getPayload({
      status: null,
      supervisorId: null,
      phase: null,
      atRisk: null,
      projectId: refreshProjectId,
    })
    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
