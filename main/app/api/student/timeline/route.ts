import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"
import { generateInitialMilestonePlan } from "@/lib/milestone-plan"

const MIN_DEPENDENCY_GAP_DAYS = 3
const MIN_BEFORE_CRITICAL_DAYS = 5
const MAX_CRITICAL_DELAY_DAYS = 3

function addDays(base: Date, days: number) {
  const next = new Date(base)
  next.setDate(next.getDate() + days)
  return next
}

function dayDiff(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24))
}

function normalizeTitle(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const project = await prisma.project.findUnique({
      where: { studentId: payload.sub },
      select: {
        id: true,
        title: true,
        description: true,
        keywords: true,
        status: true,
        createdAt: true,
        milestones: {
          orderBy: {
            dueDate: "asc",
          },
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
      },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    let milestones = project.milestones

    if (milestones.length === 0) {
      const generatedMilestones = generateInitialMilestonePlan({
        projectId: project.id,
        title: project.title,
        description: project.description,
        keywords: project.keywords,
        startDate: project.createdAt,
      })

      await prisma.milestone.createMany({
        data: generatedMilestones,
      })

      const refreshedProject = await prisma.project.findUnique({
        where: { id: project.id },
        select: {
          milestones: {
            orderBy: {
              dueDate: "asc",
            },
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
        },
      })

      milestones = refreshedProject?.milestones || []
    }

    return NextResponse.json(
      {
        project: {
          id: project.id,
          title: project.title,
          status: project.status,
        },
        milestones,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const title = typeof body.title === "string" ? body.title.trim() : ""
    const description =
      typeof body.description === "string" ? body.description.trim() : null
    const dueDate = typeof body.dueDate === "string" ? body.dueDate.trim() : ""
    const status =
      typeof body.status === "string" ? body.status.trim() : "pending"
    const isCriticalPath = Boolean(body.isCriticalPath)

    if (!title) {
      return NextResponse.json(
        { error: "Milestone title is required" },
        { status: 400 }
      )
    }

    if (!dueDate) {
      return NextResponse.json(
        { error: "Due date is required" },
        { status: 400 }
      )
    }

    const project = await prisma.project.findUnique({
      where: { studentId: payload.sub },
      select: { id: true },
    })

    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 })
    }

    const milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        title,
        description,
        dueDate: new Date(dueDate),
        status,
        isCriticalPath,
      },
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
    })

    return NextResponse.json({ milestone }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.trim() : ""

    if (action === "regenerate_initial_plan") {
      const project = await prisma.project.findUnique({
        where: { studentId: payload.sub },
        select: {
          id: true,
          title: true,
          description: true,
          keywords: true,
          createdAt: true,
          milestones: {
            orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
            select: {
              id: true,
              title: true,
              status: true,
              dueDate: true,
            },
          },
        },
      })

      if (!project) {
        return NextResponse.json({ error: "Project not found" }, { status: 404 })
      }

      const lockedMilestones = project.milestones.filter(
        (m) => m.status === "completed" || m.status === "in_progress"
      )
      const replaceableMilestones = project.milestones.filter(
        (m) => m.status !== "completed" && m.status !== "in_progress"
      )

      const lockedTitleSet = new Set(
        lockedMilestones.map((m) => normalizeTitle(m.title))
      )

      let generatedPlan = generateInitialMilestonePlan({
        projectId: project.id,
        title: project.title,
        description: project.description,
        keywords: project.keywords,
        startDate: project.createdAt,
      }).filter((m) => !lockedTitleSet.has(normalizeTitle(m.title)))

      if (lockedMilestones.length > 0 && generatedPlan.length > 0) {
        const latestLockedDueDate = lockedMilestones.reduce((latest, item) => {
          return item.dueDate > latest ? item.dueDate : latest
        }, lockedMilestones[0].dueDate)

        const minGeneratedDate = addDays(latestLockedDueDate, MIN_DEPENDENCY_GAP_DAYS)
        const currentFirstGeneratedDate = generatedPlan[0].dueDate
        const shiftDays = Math.max(
          0,
          dayDiff(currentFirstGeneratedDate, minGeneratedDate)
        )

        if (shiftDays > 0) {
          generatedPlan = generatedPlan.map((m) => ({
            ...m,
            dueDate: addDays(m.dueDate, shiftDays),
          }))
        }
      }

      await prisma.$transaction([
        prisma.milestone.deleteMany({
          where: {
            projectId: project.id,
            status: { in: ["pending", "delayed"] },
          },
        }),
        ...(generatedPlan.length > 0
          ? [
              prisma.milestone.createMany({
                data: generatedPlan,
              }),
            ]
          : []),
      ])

      const refreshed = await prisma.project.findUnique({
        where: { id: project.id },
        select: {
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
        },
      })

      return NextResponse.json(
        {
          milestones: refreshed?.milestones || [],
          regeneration: {
            preservedCount: lockedMilestones.length,
            replacedCount: replaceableMilestones.length,
            createdCount: generatedPlan.length,
            strategy:
              "Preserved completed/in-progress milestones and regenerated pending/delayed milestones from the current project idea.",
          },
        },
        { status: 200 }
      )
    }

    const milestoneId =
      typeof body.milestoneId === "string" ? body.milestoneId.trim() : ""
    const status =
      typeof body.status === "string" ? body.status.trim() : ""
    const delayDaysRaw =
      typeof body.delayDays === "number" ? body.delayDays : Number(body.delayDays)

    if (!milestoneId) {
      return NextResponse.json(
        { error: "Milestone ID is required" },
        { status: 400 }
      )
    }

    if (!["pending", "in_progress", "completed", "delayed"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid milestone status" },
        { status: 400 }
      )
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: {
        id: true,
        title: true,
        projectId: true,
        dueDate: true,
        status: true,
        isCriticalPath: true,
        project: {
          select: {
            studentId: true,
          },
        },
      },
    })

    if (!milestone) {
      return NextResponse.json(
        { error: "Milestone not found" },
        { status: 404 }
      )
    }

    if (milestone.project.studentId !== payload.sub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (status === "delayed" && milestone.status === "completed") {
      return NextResponse.json(
        { error: "Completed milestones cannot be marked as delayed." },
        { status: 400 }
      )
    }

    let updatedMilestone: {
      id: string
      projectId: string
      title: string
      description: string | null
      dueDate: Date
      status: string
      isCriticalPath: boolean
      feedback: string | null
      completedDate: Date | null
      createdAt: Date
      updatedAt: Date
    }
    let rescheduledCount = 0
    let recalculation:
      | {
          shiftDaysRequested: number
          shiftDaysApplied: number
          dependencyGapDays: number
          criticalBufferDays: number
          protectedCriticalCount: number
          warnings: string[]
        }
      | null = null

    if (status === "delayed") {
      const shiftDaysRequested =
        Number.isFinite(delayDaysRaw) && delayDaysRaw > 0 ? delayDaysRaw : 7

      if (milestone.isCriticalPath && shiftDaysRequested > MAX_CRITICAL_DELAY_DAYS) {
        return NextResponse.json(
          {
            error: `Critical milestones can only be delayed by up to ${MAX_CRITICAL_DELAY_DAYS} days at a time.`,
          },
          { status: 400 }
        )
      }

      const schedulingMilestones = await prisma.milestone.findMany({
        where: {
          projectId: milestone.projectId,
          status: { not: "completed" },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          title: true,
          dueDate: true,
          isCriticalPath: true,
          createdAt: true,
        },
      })

      const currentIndex = schedulingMilestones.findIndex(
        (item) => item.id === milestoneId
      )

      if (currentIndex === -1) {
        return NextResponse.json(
          { error: "Milestone could not be scheduled for recalculation." },
          { status: 400 }
        )
      }

      const warnings: string[] = []
      let protectedCriticalCount = 0
      let shiftDaysApplied = shiftDaysRequested

      if (!milestone.isCriticalPath) {
        const nextCritical = schedulingMilestones.find(
          (item, index) => index > currentIndex && item.isCriticalPath
        )

        if (nextCritical) {
          const latestAllowedDate = addDays(
            new Date(nextCritical.dueDate),
            -MIN_BEFORE_CRITICAL_DAYS
          )
          const proposedDate = addDays(new Date(milestone.dueDate), shiftDaysRequested)

          if (proposedDate > latestAllowedDate) {
            shiftDaysApplied = Math.max(
              0,
              dayDiff(new Date(milestone.dueDate), latestAllowedDate)
            )
            protectedCriticalCount += 1
            warnings.push(
              `Delay capped to ${shiftDaysApplied} days to protect upcoming critical milestone "${nextCritical.title}".`
            )
          }
        }
      }

      const targetDueDate = addDays(new Date(milestone.dueDate), shiftDaysApplied)
      const downstreamMilestones = schedulingMilestones.slice(currentIndex + 1)
      const downstreamUpdates: Array<{ id: string; dueDate: Date }> = []

      let previousScheduledDate = targetDueDate

      for (const item of downstreamMilestones) {
        if (item.isCriticalPath) {
          const minimumForCritical = addDays(
            previousScheduledDate,
            MIN_BEFORE_CRITICAL_DAYS
          )

          if (new Date(item.dueDate) < minimumForCritical) {
            protectedCriticalCount += 1
            warnings.push(
              `Critical milestone "${item.title}" is now at-risk; manual intervention is recommended.`
            )
          }

          // Keep critical milestones fixed, but preserve sequence anchor for downstream.
          previousScheduledDate =
            new Date(item.dueDate) > previousScheduledDate
              ? new Date(item.dueDate)
              : previousScheduledDate
          continue
        }

        const shiftedDate = addDays(new Date(item.dueDate), shiftDaysApplied)
        const dependencyFloor = addDays(
          previousScheduledDate,
          MIN_DEPENDENCY_GAP_DAYS
        )
        const recalculatedDate =
          shiftedDate > dependencyFloor ? shiftedDate : dependencyFloor

        if (recalculatedDate.getTime() !== new Date(item.dueDate).getTime()) {
          downstreamUpdates.push({
            id: item.id,
            dueDate: recalculatedDate,
          })
        }

        previousScheduledDate = recalculatedDate
      }

      const txResults = await prisma.$transaction([
        prisma.milestone.update({
          where: { id: milestoneId },
          data: {
            status,
            completedDate: null,
            dueDate: targetDueDate,
          },
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
        }),
        ...downstreamUpdates.map((item) =>
          prisma.milestone.update({
            where: { id: item.id },
            data: {
              dueDate: item.dueDate,
            },
          })
        ),
      ])

      updatedMilestone = txResults[0] as typeof updatedMilestone
      rescheduledCount = downstreamUpdates.length
      recalculation = {
        shiftDaysRequested,
        shiftDaysApplied,
        dependencyGapDays: MIN_DEPENDENCY_GAP_DAYS,
        criticalBufferDays: MIN_BEFORE_CRITICAL_DAYS,
        protectedCriticalCount,
        warnings,
      }
    } else {
      updatedMilestone = await prisma.milestone.update({
        where: { id: milestoneId },
        data: {
          status,
          completedDate: status === "completed" ? new Date() : null,
        },
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
      })
    }

    return NextResponse.json(
      {
        milestone: updatedMilestone,
        rescheduledCount,
        recalculation,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
