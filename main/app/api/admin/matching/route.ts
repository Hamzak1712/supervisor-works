import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import {
  getMatchingEvaluationMetrics,
  getMatchingSettings,
  rerunMatchingForStudent,
  rerunMatchingGlobally,
} from "@/lib/matching-engine"

async function requireAdmin(req: Request) {
  const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

  if (!payload) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (!requireRole(payload, "ADMIN")) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { ok: true as const, payload }
}

function validWeight(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
}

async function getPayload() {
  const [
    settings,
    blacklist,
    metrics,
    recommendationsCount,
    students,
    supervisors,
  ] =
    await Promise.all([
      getMatchingSettings(prisma),
      prisma.matchingBlacklist.findMany({
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          studentId: true,
          supervisorId: true,
          reason: true,
          createdAt: true,
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
      }),
      getMatchingEvaluationMetrics(prisma),
      prisma.matchRecommendation.groupBy({
        by: ["studentId"],
      }),
      prisma.user.findMany({
        where: {
          role: "STUDENT",
        },
        select: {
          id: true,
          email: true,
          studentProfile: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
      prisma.user.findMany({
        where: {
          role: "SUPERVISOR",
          status: "ACTIVE",
          supervisorProfile: {
            is: {
              acceptingStudents: true,
            },
          },
        },
        select: {
          id: true,
          email: true,
          supervisorProfile: {
            select: {
              fullName: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      }),
    ])

  return {
    settings,
    blacklist: blacklist.map((item) => ({
      id: item.id,
      studentId: item.studentId,
      supervisorId: item.supervisorId,
      reason: item.reason,
      createdAt: item.createdAt,
      studentName:
        item.student.studentProfile?.fullName || item.student.email,
      studentEmail: item.student.email,
      supervisorName:
        item.supervisor.supervisorProfile?.fullName || item.supervisor.email,
      supervisorEmail: item.supervisor.email,
    })),
    metrics,
    summary: {
      blacklistedPairs: blacklist.length,
      studentsWithRecommendations: recommendationsCount.length,
    },
    students: students.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.studentProfile?.fullName || user.email,
    })),
    supervisors: supervisors.map((user) => ({
      id: user.id,
      email: user.email,
      fullName: user.supervisorProfile?.fullName || user.email,
    })),
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req)
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
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.trim() : ""

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    if (action === "update_settings") {
      const semanticWeight = body.semanticWeight
      const keywordWeight = body.keywordWeight
      const capacityWeight = body.capacityWeight
      const responseSpeedWeight = body.responseSpeedWeight
      const minMatchThreshold = body.minMatchThreshold
      const recommendationCount = body.recommendationCount
      const aiExplanationEnabled = body.aiExplanationEnabled

      if (
        !validWeight(semanticWeight) ||
        !validWeight(keywordWeight) ||
        !validWeight(capacityWeight) ||
        !validWeight(responseSpeedWeight)
      ) {
        return NextResponse.json(
          { error: "All weight values must be valid non-negative numbers" },
          { status: 400 }
        )
      }

      const sum =
        semanticWeight +
        keywordWeight +
        capacityWeight +
        responseSpeedWeight

      if (sum !== 100) {
        return NextResponse.json(
          { error: "Weights must sum to 100" },
          { status: 400 }
        )
      }

      if (
        typeof minMatchThreshold !== "number" ||
        !Number.isFinite(minMatchThreshold) ||
        minMatchThreshold < 0 ||
        minMatchThreshold > 100
      ) {
        return NextResponse.json(
          { error: "minMatchThreshold must be a number between 0 and 100" },
          { status: 400 }
        )
      }

      if (
        typeof recommendationCount !== "number" ||
        !Number.isFinite(recommendationCount) ||
        recommendationCount < 1 ||
        recommendationCount > 20
      ) {
        return NextResponse.json(
          { error: "recommendationCount must be a number between 1 and 20" },
          { status: 400 }
        )
      }

      await prisma.matchingConfig.upsert({
        where: { id: "global" },
        update: {
          semanticWeight,
          keywordWeight,
          capacityWeight,
          responseSpeedWeight,
          minMatchThreshold: Math.round(minMatchThreshold),
          recommendationCount: Math.round(recommendationCount),
          aiExplanationEnabled:
            typeof aiExplanationEnabled === "boolean"
              ? aiExplanationEnabled
              : true,
        },
        create: {
          id: "global",
          semanticWeight,
          keywordWeight,
          capacityWeight,
          responseSpeedWeight,
          minMatchThreshold: Math.round(minMatchThreshold),
          recommendationCount: Math.round(recommendationCount),
          aiExplanationEnabled:
            typeof aiExplanationEnabled === "boolean"
              ? aiExplanationEnabled
              : true,
        },
      })
    } else if (action === "rerun_global") {
      const rerun = await rerunMatchingGlobally(prisma)
      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          rerun,
        },
        { status: 200 }
      )
    } else if (action === "rerun_student") {
      const studentId =
        typeof body.studentId === "string" ? body.studentId.trim() : ""

      if (!studentId) {
        return NextResponse.json(
          { error: "studentId is required" },
          { status: 400 }
        )
      }

      const rerun = await rerunMatchingForStudent(prisma, studentId)

      if (!rerun.success) {
        return NextResponse.json(
          { error: rerun.error || "Failed to rerun matching for student" },
          { status: 400 }
        )
      }

      const payload = await getPayload()
      return NextResponse.json(
        {
          ...payload,
          rerun,
        },
        { status: 200 }
      )
    } else if (action === "add_blacklist") {
      const studentId =
        typeof body.studentId === "string" ? body.studentId.trim() : ""
      const supervisorId =
        typeof body.supervisorId === "string" ? body.supervisorId.trim() : ""
      const reason =
        typeof body.reason === "string" && body.reason.trim()
          ? body.reason.trim()
          : null

      if (!studentId || !supervisorId) {
        return NextResponse.json(
          { error: "studentId and supervisorId are required" },
          { status: 400 }
        )
      }

      if (studentId === supervisorId) {
        return NextResponse.json(
          { error: "studentId and supervisorId cannot be the same" },
          { status: 400 }
        )
      }

      await prisma.matchingBlacklist.upsert({
        where: {
          studentId_supervisorId: {
            studentId,
            supervisorId,
          },
        },
        update: {
          reason,
        },
        create: {
          studentId,
          supervisorId,
          reason,
        },
      })
    } else if (action === "remove_blacklist") {
      const blacklistId =
        typeof body.blacklistId === "string" ? body.blacklistId.trim() : ""

      if (blacklistId) {
        await prisma.matchingBlacklist.delete({
          where: { id: blacklistId },
        })
      } else {
        const studentId =
          typeof body.studentId === "string" ? body.studentId.trim() : ""
        const supervisorId =
          typeof body.supervisorId === "string" ? body.supervisorId.trim() : ""

        if (!studentId || !supervisorId) {
          return NextResponse.json(
            {
              error:
                "Provide blacklistId or both studentId and supervisorId",
            },
            { status: 400 }
          )
        }

        await prisma.matchingBlacklist.delete({
          where: {
            studentId_supervisorId: {
              studentId,
              supervisorId,
            },
          },
        })
      }
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const payload = await getPayload()
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Update failed" }, { status: 500 })
  }
}
