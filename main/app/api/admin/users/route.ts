import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { randomBytes } from "crypto"
import { AccountStatus, Prisma, Role } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

async function requireAdmin(req: Request) {
  const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

  if (!payload) {
    return { ok: false as const, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) }
  }

  if (!requireRole(payload, "ADMIN")) {
    return { ok: false as const, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) }
  }

  return { ok: true as const, payload }
}

async function getUserDetails(userId: string) {
  const [
    user,
    unreadNotifications,
    pendingSentRequests,
    pendingReceivedRequests,
    acceptedSentRequests,
    declinedSentRequests,
    acceptedReceivedRequests,
    declinedReceivedRequests,
  ] =
    await prisma.$transaction([
      prisma.user.findUnique({
        where: { id: userId },
        include: {
          studentProfile: true,
          supervisorProfile: true,
          assignedStudents: {
            select: {
              id: true,
              fullName: true,
              user: {
                select: {
                  id: true,
                  email: true,
                  project: {
                    select: {
                      id: true,
                      title: true,
                      status: true,
                    },
                  },
                },
              },
            },
          },
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
      prisma.supervisionRequest.count({
        where: {
          studentId: userId,
          status: "accepted",
        },
      }),
      prisma.supervisionRequest.count({
        where: {
          studentId: userId,
          status: "declined",
        },
      }),
      prisma.supervisionRequest.count({
        where: {
          supervisorId: userId,
          status: "accepted",
        },
      }),
      prisma.supervisionRequest.count({
        where: {
          supervisorId: userId,
          status: "declined",
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
      acceptedSentRequests,
      declinedSentRequests,
      acceptedReceivedRequests,
      declinedReceivedRequests,
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
    const search = searchParams.get("search")?.trim()
    const roleParam = searchParams.get("role")?.trim().toUpperCase()
    const statusParam = searchParams.get("status")?.trim().toUpperCase()

    if (userId) {
      const details = await getUserDetails(userId)

      if (!details) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      return NextResponse.json(details, { status: 200 })
    }

    const where: Prisma.UserWhereInput = {}

    if (roleParam && ["STUDENT", "SUPERVISOR", "ADMIN"].includes(roleParam)) {
      where.role = roleParam as Role
    }

    if (statusParam && ["ACTIVE", "SUSPENDED", "PENDING"].includes(statusParam)) {
      where.status = statusParam as AccountStatus
    }

    if (search) {
      where.OR = [
        {
          email: {
            contains: search,
            mode: "insensitive",
          },
        },
        {
          studentProfile: {
            is: {
              fullName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
        {
          supervisorProfile: {
            is: {
              fullName: {
                contains: search,
                mode: "insensitive",
              },
            },
          },
        },
      ]
    }

    const users = await prisma.user.findMany({
      where,
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

    const temporaryPassword = randomBytes(9).toString("base64url")
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

    return NextResponse.json({ user, temporaryPassword }, { status: 201 })
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
    const userIds: string[] = Array.isArray(body.userIds)
      ? body.userIds.filter(
          (id: unknown): id is string =>
            typeof id === "string" && id.trim().length > 0
        )
      : []
    const targetUserIds: string[] = Array.from(
      new Set([...userIds.map((id: string) => id.trim()), ...(userId ? [userId] : [])])
    )
    const roleRaw = typeof body.role === "string" ? body.role.trim() : ""
    const statusRaw =
      typeof body.status === "string" ? body.status.trim() : ""
    const action = typeof body.action === "string" ? body.action.trim() : ""

    if (targetUserIds.length === 0 && action !== "send_email") {
      return NextResponse.json(
        { error: "userId or userIds is required" },
        { status: 400 }
      )
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
        typeof body.message === "string" ? body.message.trim() : ""

      if (!message) {
        return NextResponse.json({ error: "message is required" }, { status: 400 })
      }

      const uniqueIds: string[] = targetUserIds

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

    if (
      statusRaw === "SUSPENDED" &&
      targetUserIds.includes(auth.payload.sub)
    ) {
      return NextResponse.json(
        { error: "You cannot suspend your own account" },
        { status: 400 }
      )
    }

    if (roleRaw && targetUserIds.length !== 1) {
      return NextResponse.json(
        { error: "Bulk role changes are not supported. Provide a single userId." },
        { status: 400 }
      )
    }

    if (statusRaw && targetUserIds.length > 1 && roleRaw) {
      return NextResponse.json(
        { error: "Bulk updates support status only." },
        { status: 400 }
      )
    }

    if (statusRaw && targetUserIds.length > 1) {
      if (!["ACTIVE", "SUSPENDED"].includes(statusRaw)) {
        return NextResponse.json(
          { error: "Invalid status. Use ACTIVE or SUSPENDED." },
          { status: 400 }
        )
      }

      const statusValue = statusRaw as AccountStatus

      await prisma.user.updateMany({
        where: { id: { in: targetUserIds } },
        data: { status: statusValue },
      })

      if (statusRaw === "SUSPENDED") {
        await prisma.user.updateMany({
          where: { id: { in: targetUserIds } },
          data: {
            sessionVersion: {
              increment: 1,
            },
          },
        })
      }

      const updatedUsers = await prisma.user.findMany({
        where: { id: { in: targetUserIds } },
        include: {
          studentProfile: true,
          supervisorProfile: true,
        },
      })

      return NextResponse.json(
        { users: updatedUsers, updatedCount: updatedUsers.length },
        { status: 200 }
      )
    }

    const data: Prisma.UserUpdateInput = {}

    if (roleRaw) {
      if (!["STUDENT", "SUPERVISOR", "ADMIN"].includes(roleRaw)) {
        return NextResponse.json({ error: "Invalid role" }, { status: 400 })
      }
      data.role = roleRaw as Role

      // Keep role-change flows safe by ensuring profile rows exist for role-specific dashboards.
      if (roleRaw === "STUDENT") {
        data.studentProfile = {
          upsert: {
            update: {},
            create: {},
          },
        }
      }

      if (roleRaw === "SUPERVISOR") {
        data.supervisorProfile = {
          upsert: {
            update: {},
            create: {},
          },
        }
      }
    }

    if (statusRaw) {
      if (!["ACTIVE", "SUSPENDED"].includes(statusRaw)) {
        return NextResponse.json(
          { error: "Invalid status. Use ACTIVE or SUSPENDED." },
          { status: 400 }
        )
      }
      data.status = statusRaw as AccountStatus

      if (statusRaw === "SUSPENDED") {
        data.sessionVersion = { increment: 1 }
      }
    }

    const updated = await prisma.user.update({
      where: { id: targetUserIds[0] },
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
    const userId =
      searchParams.get("userId")?.trim() || searchParams.get("id")?.trim()

    if (!userId) {
      return NextResponse.json(
        { error: "userId query parameter is required" },
        { status: 400 }
      )
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
