import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"

const DAY_MS = 1000 * 60 * 60 * 24

async function requireAdmin(req: Request, permissionKey: string) {
  const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

  if (!payload) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (!requireRole(payload, "ADMIN")) {
    const permitted = await hasPermission(payload, permissionKey)
    if (permitted) {
      return { ok: true as const, payload }
    }

    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { ok: true as const, payload }
}

function toPositiveInt(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(1, Math.floor(value))
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(1, Math.floor(parsed))
    }
  }

  return null
}

function calcAgeDays(createdAt: Date, nowMs: number) {
  return Math.floor((nowMs - createdAt.getTime()) / DAY_MS)
}

function formatPersonName(fullName: string | null | undefined, email: string) {
  return fullName || email.split("@")[0] || email
}

async function getConfig() {
  return prisma.requestOversightConfig.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      slaDays: 7,
      staleExpireDays: 14,
    },
  })
}

async function getPayload() {
  const config = await getConfig()

  const requests = await prisma.supervisionRequest.findMany({
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      studentId: true,
      supervisorId: true,
      projectId: true,
      status: true,
      message: true,
      createdAt: true,
      respondedAt: true,
      responseMessage: true,
      student: {
        select: {
          id: true,
          email: true,
          studentProfile: {
            select: {
              fullName: true,
            },
          },
        },
      },
      supervisor: {
        select: {
          id: true,
          email: true,
          status: true,
          supervisorProfile: {
            select: {
              fullName: true,
            },
          },
        },
      },
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          academicPeriod: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  })

  const nowMs = Date.now()

  const mapped = requests.map((item) => {
    const ageDays = calcAgeDays(item.createdAt, nowMs)
    const isPending = item.status === "pending"
    const isEscalated = isPending && ageDays >= config.slaDays
    const isStale = isPending && ageDays >= config.staleExpireDays

    return {
      id: item.id,
      status: item.status,
      message: item.message,
      createdAt: item.createdAt,
      respondedAt: item.respondedAt,
      responseMessage: item.responseMessage,
      ageDays,
      isEscalated,
      isStale,
      student: {
        id: item.student.id,
        email: item.student.email,
        fullName: formatPersonName(
          item.student.studentProfile?.fullName,
          item.student.email
        ),
      },
      supervisor: {
        id: item.supervisor.id,
        email: item.supervisor.email,
        status: item.supervisor.status,
        fullName: formatPersonName(
          item.supervisor.supervisorProfile?.fullName,
          item.supervisor.email
        ),
      },
      project: item.project
        ? {
            id: item.project.id,
            title: item.project.title || "Untitled Project",
            status: item.project.status,
            academicPeriod: item.project.academicPeriod,
          }
        : null,
    }
  })

  const statusCounts = {
    pending: 0,
    accepted: 0,
    declined: 0,
    withdrawn: 0,
    expired: 0,
    other: 0,
  }

  for (const request of mapped) {
    if (request.status === "pending") statusCounts.pending += 1
    else if (request.status === "accepted") statusCounts.accepted += 1
    else if (request.status === "declined") statusCounts.declined += 1
    else if (request.status === "withdrawn") statusCounts.withdrawn += 1
    else if (request.status === "expired") statusCounts.expired += 1
    else statusCounts.other += 1
  }

  return {
    config,
    summary: {
      totalRequests: mapped.length,
      escalatedPending: mapped.filter((item) => item.isEscalated).length,
      stalePending: mapped.filter((item) => item.isStale).length,
      statusCounts,
    },
    escalationQueue: mapped
      .filter((item) => item.isEscalated)
      .sort((a, b) => b.ageDays - a.ageDays),
    requests: mapped,
    generatedAt: new Date().toISOString(),
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req, "admin.requests.manage")
    if (!auth.ok) return auth.response

    const payload = await getPayload()
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin(req, "admin.requests.manage")
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.trim() : ""

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    if (action === "update_config") {
      const slaDays = toPositiveInt(body.slaDays)
      const staleExpireDays = toPositiveInt(body.staleExpireDays)

      if (!slaDays || !staleExpireDays) {
        return NextResponse.json(
          { error: "slaDays and staleExpireDays must be valid positive integers" },
          { status: 400 }
        )
      }

      if (staleExpireDays < slaDays) {
        return NextResponse.json(
          { error: "staleExpireDays must be greater than or equal to slaDays" },
          { status: 400 }
        )
      }

      await prisma.requestOversightConfig.upsert({
        where: { id: "global" },
        update: {
          slaDays,
          staleExpireDays,
        },
        create: {
          id: "global",
          slaDays,
          staleExpireDays,
        },
      })

      const payload = await getPayload()
      return NextResponse.json(payload, { status: 200 })
    }

    if (action === "force_expire_stale") {
      const config = await getConfig()
      const thresholdDays = toPositiveInt(body.thresholdDays) || config.staleExpireDays
      const staleBefore = new Date(Date.now() - thresholdDays * DAY_MS)
      const now = new Date()

      const stalePending = await prisma.supervisionRequest.findMany({
        where: {
          status: "pending",
          createdAt: {
            lte: staleBefore,
          },
        },
        select: {
          id: true,
          studentId: true,
          supervisorId: true,
          student: {
            select: {
              email: true,
              studentProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          supervisor: {
            select: {
              email: true,
              supervisorProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      })

      if (stalePending.length > 0) {
        const staleIds = stalePending.map((item) => item.id)

        await prisma.$transaction(async (tx) => {
          await tx.supervisionRequest.updateMany({
            where: {
              id: {
                in: staleIds,
              },
            },
            data: {
              status: "expired",
              respondedAt: now,
              responseMessage: `Automatically expired by admin after ${thresholdDays} day(s) without response.`,
            },
          })

          await tx.notification.createMany({
            data: stalePending.flatMap((item) => {
              const supervisorName = formatPersonName(
                item.supervisor.supervisorProfile?.fullName,
                item.supervisor.email
              )
              const studentName = formatPersonName(
                item.student.studentProfile?.fullName,
                item.student.email
              )

              return [
                {
                  userId: item.studentId,
                  title: "Supervision request expired",
                  body: `Your request to ${supervisorName} expired due to no response.`,
                  type: "request_update",
                },
                {
                  userId: item.supervisorId,
                  title: "Supervision request expired",
                  body: `A pending request from ${studentName} was expired by an admin.`,
                  type: "request_update",
                },
              ]
            }),
          })
        })
      }

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          actionResult: {
            expiredCount: stalePending.length,
            thresholdDays,
          },
        },
        { status: 200 }
      )
    }

    if (action === "manual_decision") {
      const requestId =
        typeof body.requestId === "string" ? body.requestId.trim() : ""
      const decision =
        typeof body.decision === "string" ? body.decision.trim() : ""
      const responseMessage =
        typeof body.responseMessage === "string"
          ? body.responseMessage.trim()
          : ""

      if (!requestId) {
        return NextResponse.json({ error: "requestId is required" }, { status: 400 })
      }

      if (!["accepted", "declined"].includes(decision)) {
        return NextResponse.json(
          { error: "decision must be accepted or declined" },
          { status: 400 }
        )
      }

      const requestRecord = await prisma.supervisionRequest.findUnique({
        where: { id: requestId },
        select: {
          id: true,
          status: true,
          studentId: true,
          supervisorId: true,
          student: {
            select: {
              email: true,
              studentProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
          supervisor: {
            select: {
              email: true,
              supervisorProfile: {
                select: {
                  fullName: true,
                },
              },
            },
          },
        },
      })

      if (!requestRecord) {
        return NextResponse.json({ error: "Request not found" }, { status: 404 })
      }

      if (requestRecord.status !== "pending") {
        return NextResponse.json(
          { error: "Only pending requests can be manually decided" },
          { status: 400 }
        )
      }

      const supervisorName = formatPersonName(
        requestRecord.supervisor.supervisorProfile?.fullName,
        requestRecord.supervisor.email
      )
      const studentName = formatPersonName(
        requestRecord.student.studentProfile?.fullName,
        requestRecord.student.email
      )
      const now = new Date()

      await prisma.$transaction(async (tx) => {
        await tx.supervisionRequest.update({
          where: { id: requestId },
          data: {
            status: decision,
            respondedAt: now,
            responseMessage:
              responseMessage ||
              (decision === "accepted"
                ? "Accepted by administrator on behalf of supervisor."
                : "Declined by administrator on behalf of supervisor."),
          },
        })

        if (decision === "accepted") {
          const otherPending = await tx.supervisionRequest.findMany({
            where: {
              studentId: requestRecord.studentId,
              status: "pending",
              id: {
                not: requestId,
              },
            },
            select: {
              id: true,
              supervisorId: true,
            },
          })

          await tx.studentProfile.updateMany({
            where: {
              userId: requestRecord.studentId,
            },
            data: {
              supervisorId: requestRecord.supervisorId,
            },
          })

          if (otherPending.length > 0) {
            await tx.supervisionRequest.updateMany({
              where: {
                id: {
                  in: otherPending.map((item) => item.id),
                },
              },
              data: {
                status: "declined",
                respondedAt: now,
                responseMessage:
                  "Another supervisor request was accepted by an administrator.",
              },
            })

            await tx.notification.createMany({
              data: otherPending.map((item) => ({
                userId: item.supervisorId,
                title: "Supervision request closed",
                body: `The request from ${studentName} was closed because another supervisor was assigned.`,
                type: "request_update",
              })),
            })
          }
        }

        await tx.notification.createMany({
          data: [
            {
              userId: requestRecord.studentId,
              title:
                decision === "accepted"
                  ? "Supervision request accepted"
                  : "Supervision request declined",
              body:
                decision === "accepted"
                  ? `An administrator accepted your request and assigned ${supervisorName}.`
                  : `An administrator declined your request to ${supervisorName}.`,
              type: "request_update",
            },
            {
              userId: requestRecord.supervisorId,
              title:
                decision === "accepted"
                  ? "Supervision request accepted by admin"
                  : "Supervision request declined by admin",
              body:
                decision === "accepted"
                  ? `An administrator accepted ${studentName}'s request on your behalf.`
                  : `An administrator declined ${studentName}'s request on your behalf.`,
              type: "request_update",
            },
          ],
        })
      })

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          actionResult: {
            requestId,
            decision,
          },
        },
        { status: 200 }
      )
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
