import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const notifications = await prisma.notification.findMany({
      where: {
        userId: payload.sub,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        read: true,
        createdAt: true,
      },
    })

    const unreadCount = notifications.reduce(
      (count, notification) => count + (notification.read ? 0 : 1),
      0
    )

    return NextResponse.json({ notifications, unreadCount }, { status: 200 })
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

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const markAll = body.markAll === true
    const notificationId =
      typeof body.notificationId === "string" ? body.notificationId.trim() : ""

    if (!markAll && !notificationId) {
      return NextResponse.json(
        { error: "notificationId is required unless markAll is true" },
        { status: 400 }
      )
    }

    if (markAll) {
      const updated = await prisma.notification.updateMany({
        where: {
          userId: payload.sub,
          read: false,
        },
        data: {
          read: true,
        },
      })

      return NextResponse.json({ updatedCount: updated.count }, { status: 200 })
    }

    const existing = await prisma.notification.findUnique({
      where: { id: notificationId },
      select: {
        id: true,
        userId: true,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      )
    }

    if (existing.userId !== payload.sub) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const notification = await prisma.notification.update({
      where: { id: notificationId },
      data: {
        read: true,
      },
      select: {
        id: true,
        title: true,
        body: true,
        type: true,
        read: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ notification }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
