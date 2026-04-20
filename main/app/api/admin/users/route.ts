import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { AccountStatus, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function requireAdmin(req: Request) {
  const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

  if (!payload) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (!requireRole(payload, "ADMIN")) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true as const, payload }
}

async function getUserDetails(userId: string) {
  const [user, unreadNotifications, pendingSentRequests, pendingReceivedRequests] =
    await prisma.$transaction([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          studentProfile: true,
          supervisorProfile: true,
          project: {
            include: {
              milestones: {
                orderBy: { dueDate: "asc" },
                take: 10,
              },
            },
          },
          _count: {
            select: {
              sentMessages: true,
              receivedMessages: true,
              meetingsOrganized: true,
              meetingsAttending: true,
              notifications: true,
              sentRequests: true,
              receivedRequests: true,
            },
          },
        },
      }),
      prisma.notification.count({
        where: {
          userId,
          read: false,
        },
      }),
      prisma.supervisionRequest.count({
        where: {
          studentId: userId,
          status: "pending",
        },
      }),
      prisma.supervisionRequest.count({
        where: {
          supervisorId: userId,
          status: "pending",
        },
      }),
    ])

  if (!user) return null

  return {
    user,
    metrics: {
      unreadNotifications,
      pendingSentRequests,
      pendingReceivedRequests,
      completedMilestones:
        user.project?.milestones.filter((m) => m.status === "completed").length || 0,
      totalMilestones: user.project?.milestones.length || 0,
    },
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req)

    if (!auth.ok) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("id")?.trim()

    if (userId) {
      const details = await getUserDetails(userId)

      if (!details) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      return NextResponse.json(details, { status: 200 })
    }

    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        studentProfile: true,
        supervisorProfile: true,
      },
    })

    return NextResponse.json({ users }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req)

    if (!auth.ok) {
      return auth.response
    }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const email =
      typeof body.email === "string" ? body.email.trim().toLowerCase() : ""
    const roleRaw = typeof body.role === "string" ? body.role.trim() : ""

    if (!email || !roleRaw) {
      return NextResponse.json(
        { error: "email and role are required" },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "Invalid email format" }, { status: 400 })
    }

    if (!["STUDENT", "SUPERVISOR", "ADMIN"].includes(roleRaw)) {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const role = roleRaw as Role

    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    })

    if (existing) {
      return NextResponse.json(
        { error: "User already exists with this email" },
        { status: 409 }
      )
    }

    const temporaryPassword = randomBytes(32).toString("hex")
    const passwordHash = await bcrypt.hash(temporaryPassword, 12)

    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role,
        status: AccountStatus.PENDING,
        studentProfile:
          role === "STUDENT"
            ? {
                create: {},
              }
            : undefined,
        supervisorProfile:
          role === "SUPERVISOR"
            ? {
                create: {},
              }
            : undefined,
      },
      include: {
        studentProfile: true,
        supervisorProfile: true,
      },
    })

    return NextResponse.json({ user }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Invite failed" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin(req)

    if (!auth.ok) {
      return auth.response
    }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const userId = typeof body.userId === "string" ? body.userId.trim() : ""
    const roleRaw = typeof body.role === "string" ? body.role.trim() : ""
    const statusRaw =
      typeof body.status === "string" ? body.status.trim() : ""
    const action = typeof body.action === "string" ? body.action.trim() : ""

    if (!userId && action !== "send_email") {
      return NextResponse.json({ error: "userId is required" }, { status: 400 })
    }

    if (action === "reset_password") {
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 })
      }

      const temporaryPassword = randomBytes(9).toString("base64url")
      const passwordHash = await bcrypt.hash(temporaryPassword, 12)

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash,
          status: AccountStatus.ACTIVE,
          sessionVersion: {
            increment: 1,
          },
        },
        include: {
          studentProfile: true,
          supervisorProfile: true,
        },
      })

      await prisma.notification.create({
        data: {
          userId,
          title: "Password reset",
          body: "An administrator reset your password. Please sign in with the temporary password and change it.",
          type: "account_security",
        },
      })

      return NextResponse.json(
        {
          user: updated,
          temporaryPassword,
          message: "Temporary password generated and existing sessions invalidated.",
        },
        { status: 200 }
      )
    }

    if (action === "end_sessions") {
      if (!userId) {
        return NextResponse.json({ error: "userId is required" }, { status: 400 })
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          sessionVersion: {
            increment: 1,
          },
        },
        include: {
          studentProfile: true,
          supervisorProfile: true,
        },
      })

      await prisma.notification.create({
        data: {
          userId,
          title: "Sessions ended",
          body: "An administrator ended all of your active sessions. Please sign in again.",
          type: "account_security",
        },
      })

      return NextResponse.json(
        {
          user: updated,
          message: "All sessions invalidated.",
        },
        { status: 200 }
      )
    }

    if (action === "send_email") {
      const subject =
        typeof body.subject === "string" && body.subject.trim()
          ? body.subject.trim()
          : "Message from administrator"
      const message =
        typeof body.message === "string" && body.message.trim()
          ? body.message.trim()
          : "An administrator sent you a message."

      const ids: string[] = Array.isArray(body.userIds)
        ? body.userIds.filter((id: unknown): id is string => typeof id === "string" && id.trim().length > 0)
        : userId
        ? [userId]
        : []

      const uniqueIds: string[] = Array.from(new Set(ids.map((id: string) => id.trim())))

      if (uniqueIds.length === 0) {
        return NextResponse.json({ error: "At least one target user is required" }, { status: 400 })
      }

      await prisma.notification.createMany({
        data: uniqueIds.map((id) => ({
          userId: id,
          title: subject,
          body: message,
          type: "admin_message",
        })),
      })

      return NextResponse.json(
        {
          success: true,
          sentCount: uniqueIds.length,
        },
        { status: 200 }
      )
    }

    if (!roleRaw && !statusRaw) {
      return NextResponse.json(
        { error: "At least one of role or status is required" },
        { status: 400 }
      )
    }

    if (userId === auth.payload.sub && statusRaw === "SUSPENDED") {
      return NextResponse.json(
        { error: "You cannot suspend your own account" },
        { status: 400 }
      )
    }

    const data: {
      role?: Role
      status?: AccountStatus
      sessionVersion?: { increment: number }
    } = {}

    if (roleRaw) {
      if (!["STUDENT", "SUPERVISOR", "ADMIN"].includes(roleRaw)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 })
      }
      data.role = roleRaw as Role
    }

    if (statusRaw) {
      if (!["ACTIVE", "SUSPENDED", "PENDING"].includes(statusRaw)) {
        return NextResponse.json({ error: "Invalid status" }, { status: 400 })
      }
      data.status = statusRaw as AccountStatus

      if (statusRaw === "SUSPENDED") {
        data.sessionVersion = { increment: 1 }
      }
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      include: {
        studentProfile: true,
        supervisorProfile: true,
      },
    })

    return NextResponse.json({ user: updated }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    const auth = await requireAdmin(req)

    if (!auth.ok) {
      return auth.response
    }

    const { searchParams } = new URL(req.url)
    const userId = searchParams.get("id")?.trim()

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 })
    }

    if (userId === auth.payload.sub) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 400 }
      )
    }

    await prisma.user.delete({
      where: { id: userId },
    })

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Delete failed" }, { status: 500 })
  }
}
