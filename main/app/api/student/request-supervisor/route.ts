import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"

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

    const project = await prisma.project.findUnique({
      where: { studentId: payload.sub },
      select: {
        id: true,
        title: true,
      },
    })

    if (!project) {
      return NextResponse.json(
        { error: "You need to create a project before sending a request" },
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