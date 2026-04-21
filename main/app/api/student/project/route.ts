import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"
import {
  autoArchiveCompletedAcademicPeriods,
  getActiveAcademicPeriod,
} from "@/lib/academic-periods"

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

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
        studentId: true,
        academicPeriodId: true,
        title: true,
        description: true,
        keywords: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        academicPeriod: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            isActive: true,
            isArchived: true,
            projectEndPolicyAt: true,
            requestSupervisorCutoffAt: true,
            proposalSubmissionCutoffAt: true,
            finalSubmissionAt: true,
          },
        },
      },
    })

    return NextResponse.json(
      {
        project: project ?? {
          id: null,
          studentId: payload.sub,
          title: null,
          description: null,
          keywords: null,
          status: "draft",
          createdAt: null,
          updatedAt: null,
        },
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

export async function PUT(req: Request) {
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

    const title = typeof body.title === "string" ? body.title.trim() : null
    const description =
      typeof body.description === "string" ? body.description.trim() : null
    const keywords =
      typeof body.keywords === "string" ? body.keywords.trim() : null
    const status = typeof body.status === "string" ? body.status.trim() : "draft"

    await autoArchiveCompletedAcademicPeriods(prisma)

    const existingProject = await prisma.project.findUnique({
      where: {
        studentId: payload.sub,
      },
      select: {
        id: true,
        academicPeriodId: true,
        academicPeriod: {
          select: {
            id: true,
            name: true,
            isArchived: true,
            proposalSubmissionCutoffAt: true,
            finalSubmissionAt: true,
          },
        },
      },
    })

    if (existingProject?.academicPeriod?.isArchived) {
      return NextResponse.json(
        {
          error:
            "This project belongs to an archived academic period and is now read-only.",
        },
        { status: 403 }
      )
    }

    const activePeriod = await getActiveAcademicPeriod(prisma)

    if (!existingProject && !activePeriod) {
      return NextResponse.json(
        {
          error:
            "No active academic period is configured. Ask an admin to activate one before creating project data.",
        },
        { status: 400 }
      )
    }

    const effectivePeriod =
      existingProject?.academicPeriod || activePeriod || null

    if (
      effectivePeriod?.proposalSubmissionCutoffAt &&
      status !== "draft" &&
      new Date() > effectivePeriod.proposalSubmissionCutoffAt
    ) {
      return NextResponse.json(
        {
          error:
            "The proposal submission cut-off date has passed for this academic period.",
        },
        { status: 400 }
      )
    }

    if (
      effectivePeriod?.finalSubmissionAt &&
      status === "completed" &&
      new Date() > effectivePeriod.finalSubmissionAt
    ) {
      return NextResponse.json(
        {
          error:
            "The final submission date has passed for this academic period.",
        },
        { status: 400 }
      )
    }

    const academicPeriodId =
      existingProject?.academicPeriodId || activePeriod?.id || null

    if (!academicPeriodId) {
      return NextResponse.json(
        {
          error:
            "No academic period could be assigned. Ask an admin to set an active period.",
        },
        { status: 400 }
      )
    }

    const project = await prisma.project.upsert({
      where: { studentId: payload.sub },
      create: {
        studentId: payload.sub,
        academicPeriodId,
        title,
        description,
        keywords,
        status,
      },
      update: {
        academicPeriodId,
        title,
        description,
        keywords,
        status,
      },
      select: {
        id: true,
        studentId: true,
        academicPeriodId: true,
        title: true,
        description: true,
        keywords: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        academicPeriod: {
          select: {
            id: true,
            name: true,
            startDate: true,
            endDate: true,
            isActive: true,
            isArchived: true,
            projectEndPolicyAt: true,
            requestSupervisorCutoffAt: true,
            proposalSubmissionCutoffAt: true,
            finalSubmissionAt: true,
          },
        },
      },
    })

    return NextResponse.json({ project }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
