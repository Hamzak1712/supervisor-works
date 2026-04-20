import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "SUPERVISOR")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const students = await prisma.studentProfile.findMany({
      where: {
        supervisorId: payload.sub,
      },
      select: {
        id: true,
        fullName: true,
        skills: true,
        interests: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      orderBy: {
        fullName: "asc",
      },
    })

    const studentIds = students.map((student) => student.user.id)

    const projects = await prisma.project.findMany({
      where: {
        studentId: {
          in: studentIds,
        },
      },
      select: {
        id: true,
        studentId: true,
        title: true,
        description: true,
        keywords: true,
        status: true,
        milestones: {
          orderBy: {
            dueDate: "asc",
          },
          select: {
            id: true,
            title: true,
            description: true,
            dueDate: true,
            status: true,
            isCriticalPath: true,
            feedback: true,
            completedDate: true,
          },
        },
      },
    })

    const result = students.map((student) => {
      const project = projects.find((p) => p.studentId === student.user.id)
      const milestones = project?.milestones ?? []

      const completed = milestones.filter((m) => m.status === "completed").length
      const total = milestones.length
      const progress = total > 0 ? Math.round((completed / total) * 100) : 0

      const nextMilestone =
        [...milestones]
          .filter((m) => m.status !== "completed")
          .sort(
            (a, b) =>
              new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
          )[0] ?? null

      return {
        student: {
          id: student.user.id,
          profileId: student.id,
          fullName: student.fullName,
          email: student.user.email,
          skills: student.skills,
          interests: student.interests,
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
        completedMilestones: completed,
        totalMilestones: total,
        nextMilestone,
      }
    })

    return NextResponse.json({ students: result }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}