import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"

export async function POST(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "SUPERVISOR")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const milestoneId =
      typeof body.milestoneId === "string" ? body.milestoneId.trim() : ""
    const feedback =
      typeof body.feedback === "string" ? body.feedback.trim() : ""

    if (!milestoneId) {
      return NextResponse.json(
        { error: "Milestone ID is required" },
        { status: 400 }
      )
    }

    if (!feedback) {
      return NextResponse.json(
        { error: "Feedback is required" },
        { status: 400 }
      )
    }

    const milestone = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: {
        id: true,
        project: {
          select: {
            student: {
              select: {
                studentProfile: {
                  select: {
                    supervisorId: true,
                  },
                },
              },
            },
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

    const assignedSupervisorId =
      milestone.project.student.studentProfile?.supervisorId ?? null

    if (assignedSupervisorId !== payload.sub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const updatedMilestone = await prisma.milestone.update({
      where: { id: milestoneId },
      data: {
        feedback,
      },
      select: {
        id: true,
        title: true,
        feedback: true,
        updatedAt: true,
      },
    })

    const studentUser = await prisma.milestone.findUnique({
      where: { id: milestoneId },
      select: {
        project: {
          select: {
            studentId: true,
          },
        },
      },
    })

    if (studentUser) {
      await prisma.notification.create({
        data: {
          userId: studentUser.project.studentId,
          title: "New milestone feedback",
          body: "Your supervisor left feedback on one of your milestones.",
          type: "milestone_feedback",
        },
      })
    }

    return NextResponse.json({ milestone: updatedMilestone }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
