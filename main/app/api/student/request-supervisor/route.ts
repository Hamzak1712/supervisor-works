import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"
import {
  autoArchiveCompletedAcademicPeriods,
  getActiveAcademicPeriod,
} from "@/lib/academic-periods"

export async function POST(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

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

    const supervisorId =
      typeof body.supervisorId === "string" ? body.supervisorId.trim() : ""
    const message =
      typeof body.message === "string" ? body.message.trim() : null

    if (!supervisorId) {
      return NextResponse.json(
        { error: "Supervisor ID is required" },
        { status: 400 }
      )
    }

    const supervisor = await prisma.user.findUnique({
      where: { id: supervisorId },
      select: {
        id: true,
        role: true,
        status: true,
        supervisorProfile: {
          select: {
            acceptingStudents: true,
          },
        },
      },
    })

    if (!supervisor || supervisor.role !== "SUPERVISOR") {
      return NextResponse.json(
        { error: "Supervisor not found" },
        { status: 404 }
      )
    }

    if (supervisor.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Supervisor account is not active" },
        { status: 400 }
      )
    }

    if (supervisor.supervisorProfile?.acceptingStudents === false) {
      return NextResponse.json(
        { error: "This supervisor has paused intake for new requests" },
        { status: 400 }
      )
    }

    const blacklistedPair = await prisma.matchingBlacklist.findUnique({
      where: {
        studentId_supervisorId: {
          studentId: payload.sub,
          supervisorId,
        },
      },
      select: {
        id: true,
      },
    })

    if (blacklistedPair) {
      return NextResponse.json(
        { error: "This pairing is blocked by administrator policy." },
        { status: 403 }
      )
    }

    await autoArchiveCompletedAcademicPeriods(prisma)

    const project = await prisma.project.findUnique({
      where: { studentId: payload.sub },
      select: {
        id: true,
        title: true,
        academicPeriodId: true,
        academicPeriod: {
          select: {
            id: true,
            name: true,
            isArchived: true,
            requestSupervisorCutoffAt: true,
          },
        },
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "You need to create a project before sending a request" },
        { status: 400 }
      )
    }

    const activePeriod = await getActiveAcademicPeriod(prisma)

    if (project.academicPeriod?.isArchived) {
      return NextResponse.json(
        {
          error:
            "This project belongs to an archived academic period and cannot submit new requests.",
        },
        { status: 403 }
      )
    }

    if (!project.academicPeriodId && activePeriod?.id) {
      await prisma.project.update({
        where: {
          id: project.id,
        },
        data: {
          academicPeriodId: activePeriod.id,
        },
      })
    }

    const effectiveProjectPeriodId =
      project.academicPeriodId || activePeriod?.id || null

    if (
      activePeriod?.id &&
      effectiveProjectPeriodId &&
      effectiveProjectPeriodId !== activePeriod.id
    ) {
      return NextResponse.json(
        {
          error:
            "Your project is not in the currently active academic period. New requests are only allowed in the active period.",
        },
        { status: 400 }
      )
    }

    if (
      (project.academicPeriod?.requestSupervisorCutoffAt ||
        activePeriod?.requestSupervisorCutoffAt) &&
      new Date() >
        (project.academicPeriod?.requestSupervisorCutoffAt ||
          activePeriod?.requestSupervisorCutoffAt)!
    ) {
      return NextResponse.json(
        {
          error: "The supervisor request cut-off date has passed.",
        },
        { status: 400 }
      )
    }

    const existing = await prisma.supervisionRequest.findUnique({
      where: {
        studentId_supervisorId: {
          studentId: payload.sub,
          supervisorId,
        },
      },
      select: {
        id: true,
        status: true,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: `Request already exists with status: ${existing.status}` },
        { status: 400 }
      )
    }

    const requestRecord = await prisma.supervisionRequest.create({
      data: {
        studentId: payload.sub,
        supervisorId,
        projectId: project.id,
        academicPeriodId: effectiveProjectPeriodId,
        status: "pending",
        message,
      },
      select: {
        id: true,
        studentId: true,
        supervisorId: true,
        projectId: true,
        status: true,
        message: true,
        createdAt: true,
      },
    })

    await prisma.notification.create({
      data: {
        userId: supervisorId,
        title: "New supervision request",
        body: `A student sent you a supervision request for "${project.title || "Untitled Project"}".`,
        type: "supervision_request",
      },
    })

    return NextResponse.json({ request: requestRecord }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
