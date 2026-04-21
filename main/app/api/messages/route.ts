import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const url = new URL(req.url)
    const otherUserId = url.searchParams.get("userId")?.trim()

    if (!otherUserId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    const messages = await prisma.message.findMany({
      where: {
        OR: [
          {
            senderId: payload.sub,
            receiverId: otherUserId,
          },
          {
            senderId: otherUserId,
            receiverId: payload.sub,
          },
        ],
      },
      orderBy: {
        createdAt: "asc",
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        body: true,
        createdAt: true,
      },
    })

    return NextResponse.json({ messages }, { status: 200 })
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
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const receiverId =
      typeof body.receiverId === "string" ? body.receiverId.trim() : ""
    const messageBody =
      typeof body.body === "string" ? body.body.trim() : ""

    if (!receiverId) {
      return NextResponse.json(
        { error: "receiverId is required" },
        { status: 400 }
      )
    }

    if (!messageBody) {
      return NextResponse.json(
        { error: "Message body is required" },
        { status: 400 }
      )
    }

    const message = await prisma.message.create({
      data: {
        senderId: payload.sub,
        receiverId,
        body: messageBody,
      },
      select: {
        id: true,
        senderId: true,
        receiverId: true,
        body: true,
        createdAt: true,
      },
    })

    await prisma.notification.create({
      data: {
        userId: receiverId,
        title: "New message",
        body: "You received a new message.",
        type: "message",
      },
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
