import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"

async function getLatestRequest(studentId: string) {
  const latestRequest = await prisma.supervisionRequest.findFirst({
    where: { studentId },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      supervisorId: true,
      status: true,
      createdAt: true,
      respondedAt: true,
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

  if (!latestRequest) return null

  return {
    id: latestRequest.id,
    supervisorId: latestRequest.supervisorId,
    supervisorName: latestRequest.supervisor.supervisorProfile?.fullName ?? null,
    supervisorEmail: latestRequest.supervisor.email,
    status: latestRequest.status,
    createdAt: latestRequest.createdAt,
    respondedAt: latestRequest.respondedAt,
  }
}

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const profile = await prisma.studentProfile.findUnique({
      where: { userId: payload.sub },
      select: {
        fullName: true,
        skills: true,
        interests: true,
        supervisorId: true,
      },
    })

    let supervisor: {
      id: string
      email: string
      fullName: string | null
      expertise: string | null
      maxCapacity: number | null
    } | null = null

    if (profile?.supervisorId) {
      const supervisorUser = await prisma.user.findUnique({
        where: { id: profile.supervisorId },
        select: {
          id: true,
          email: true,
          supervisorProfile: {
            select: {
              fullName: true,
              expertise: true,
              maxCapacity: true,
            },
          },
        },
      })

      if (supervisorUser) {
        supervisor = {
          id: supervisorUser.id,
          email: supervisorUser.email,
          fullName: supervisorUser.supervisorProfile?.fullName ?? null,
          expertise: supervisorUser.supervisorProfile?.expertise ?? null,
          maxCapacity: supervisorUser.supervisorProfile?.maxCapacity ?? null,
        }
      }
    }

    const latestRequest = await getLatestRequest(payload.sub)

    return NextResponse.json(
      {
        profile: {
          fullName: profile?.fullName ?? null,
          skills: profile?.skills ?? null,
          interests: profile?.interests ?? null,
          supervisorId: profile?.supervisorId ?? null,
        },
        supervisor,
        latestRequest,
      },
      { status: 200 }
    )
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

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { error: "Invalid JSON body" },
        { status: 400 }
      )
    }

    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : null
    const skills =
      typeof body.skills === "string" ? body.skills.trim() : null
    const interests =
      typeof body.interests === "string" ? body.interests.trim() : null

    const profile = await prisma.studentProfile.upsert({
      where: { userId: payload.sub },
      create: {
        userId: payload.sub,
        fullName,
        skills,
        interests,
      },
      update: {
        fullName,
        skills,
        interests,
      },
      select: {
        fullName: true,
        skills: true,
        interests: true,
        supervisorId: true,
      },
    })

    let supervisor: {
      id: string
      email: string
      fullName: string | null
      expertise: string | null
      maxCapacity: number | null
    } | null = null

    if (profile.supervisorId) {
      const supervisorUser = await prisma.user.findUnique({
        where: { id: profile.supervisorId },
        select: {
          id: true,
          email: true,
          supervisorProfile: {
            select: {
              fullName: true,
              expertise: true,
              maxCapacity: true,
            },
          },
        },
      })

      if (supervisorUser) {
        supervisor = {
          id: supervisorUser.id,
          email: supervisorUser.email,
          fullName: supervisorUser.supervisorProfile?.fullName ?? null,
          expertise: supervisorUser.supervisorProfile?.expertise ?? null,
          maxCapacity: supervisorUser.supervisorProfile?.maxCapacity ?? null,
        }
      }
    }

    const latestRequest = await getLatestRequest(payload.sub)

    return NextResponse.json(
      {
        profile,
        supervisor,
        latestRequest,
      },
      { status: 200 }
    )
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
