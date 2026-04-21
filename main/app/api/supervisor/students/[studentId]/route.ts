import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"

export async function GET(
  req: Request,
  context: { params: Promise<{ studentId: string }> }
) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "SUPERVISOR")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { studentId } = await context.params
    const targetStudentId = (studentId || "").trim()

    if (!targetStudentId) {
      return NextResponse.json({ error: "Student ID is required" }, { status: 400 })
    }

    const studentProfile = await prisma.studentProfile.findUnique({
      where: { userId: targetStudentId },
      select: {
        id: true,
        fullName: true,
        skills: true,
        interests: true,
        supervisorId: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
    })

    if (!studentProfile) {
      return NextResponse.json({ error: "Student not found" }, { status: 404 })
    }

    if (studentProfile.supervisorId !== payload.sub) {
      const relatedRequest = await prisma.supervisionRequest.findFirst({
        where: {
          studentId: targetStudentId,
          supervisorId: payload.sub,
        },
        select: { id: true },
      })

      if (!relatedRequest) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
      }
    }

    const project = await prisma.project.findUnique({
      where: { studentId: targetStudentId },
      select: {
        id: true,
        title: true,
        description: true,
        keywords: true,
        status: true,
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

    const milestones = project?.milestones ?? []
    const completedMilestones = milestones.filter((m) => m.status === "completed").length
    const totalMilestones = milestones.length
    const progress =
      totalMilestones > 0
        ? Math.round((completedMilestones / totalMilestones) * 100)
        : 0
    const delayedMilestones = milestones.filter((m) => m.status === "delayed").length

    const nextMilestone =
      [...milestones]
        .filter((m) => m.status !== "completed")
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0] ??
      null

    return NextResponse.json(
      {
        student: {
          id: studentProfile.user.id,
          profileId: studentProfile.id,
          fullName: studentProfile.fullName,
          email: studentProfile.user.email,
          skills: studentProfile.skills,
          interests: studentProfile.interests,
        },
        project: project
          ? {
              id: project.id,
              title: project.title,
              description: project.description,
              keywords: project.keywords,
              status: project.status,
              milestones,
            }
          : null,
        progress,
        completedMilestones,
        totalMilestones,
        delayedMilestones,
        nextMilestone,
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
