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

    const requestId =
      typeof body.requestId === "string" ? body.requestId.trim() : ""
    const action =
      typeof body.action === "string" ? body.action.trim() : ""
    const responseMessage =
      typeof body.responseMessage === "string"
        ? body.responseMessage.trim()
        : null

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required" },
        { status: 400 }
      )
    }

    if (!["accepted", "declined"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be accepted or declined" },
        { status: 400 }
      )
    }

    const requestRecord = await prisma.supervisionRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        studentId: true,
        supervisorId: true,
        status: true,
      },
    })

    if (!requestRecord) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 })
    }

    if (requestRecord.supervisorId !== payload.sub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    if (requestRecord.status !== "pending") {
      return NextResponse.json(
        { error: "This request has already been handled" },
        { status: 400 }
      )
    }

    const updated = await prisma.supervisionRequest.update({
      where: { id: requestId },
      data: {
        status: action,
        respondedAt: new Date(),
        responseMessage,
      },
      select: {
        id: true,
        studentId: true,
        supervisorId: true,
        status: true,
        responseMessage: true,
        respondedAt: true,
      },
    })

    if (action === "accepted") {
      await prisma.studentProfile.updateMany({
        where: {
          userId: requestRecord.studentId,
        },
        data: {
          supervisorId: payload.sub,
        },
      })

      await prisma.supervisionRequest.updateMany({
        where: {
          studentId: requestRecord.studentId,
          id: { not: requestId },
          status: "pending",
        },
        data: {
          status: "declined",
          respondedAt: new Date(),
          responseMessage: "Another supervisor has already accepted this student.",
        },
      })
    }

    await prisma.notification.create({
      data: {
        userId: requestRecord.studentId,
        title:
          action === "accepted"
            ? "Supervision request accepted"
            : "Supervision request declined",
        body:
          action === "accepted"
            ? "A supervisor accepted your request and has been assigned to your project."
            : "A supervisor declined your supervision request.",
        type: "request_update",
      },
    })

    return NextResponse.json({ request: updated }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}