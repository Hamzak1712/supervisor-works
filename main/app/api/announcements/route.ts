import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader } from "@/lib/auth"

const db = prisma as any

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })
    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = (await db.user.findUnique({
      where: { id: payload.sub },
      select: {
        role: true,
        project: {
          select: {
            academicPeriod: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    })) as {
      role: "STUDENT" | "SUPERVISOR" | "ADMIN"
      project: {
        academicPeriod: {
          name: string
        } | null
      } | null
    } | null

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const now = new Date()

    const allActive = (await db.announcement.findMany({
      where: {
        startsAt: {
          lte: now,
        },
        OR: [
          { expiresAt: null },
          {
            expiresAt: {
              gt: now,
            },
          },
        ],
      },
      orderBy: [
        {
          startsAt: "desc",
        },
        {
          createdAt: "desc",
        },
      ],
      select: {
        id: true,
        title: true,
        body: true,
        severity: true,
        audience: true,
        audienceYearGroup: true,
        startsAt: true,
        expiresAt: true,
      },
    })) as Array<{
      id: string
      title: string
      body: string
      severity: "INFO" | "WARNING" | "CRITICAL"
      audience: "ALL" | "STUDENTS" | "SUPERVISORS" | "YEAR_GROUP"
      audienceYearGroup: string | null
      startsAt: Date
      expiresAt: Date | null
    }>

    const audienceFiltered = allActive.filter((announcement) => {
      if (announcement.audience === "ALL") return true
      if (
        announcement.audience === "STUDENTS" &&
        user.role === "STUDENT"
      ) {
        return true
      }
      if (
        announcement.audience === "SUPERVISORS" &&
        user.role === "SUPERVISOR"
      ) {
        return true
      }

      if (announcement.audience === "YEAR_GROUP") {
        if (user.role !== "STUDENT") return false
        const targetYear = announcement.audienceYearGroup?.trim().toLowerCase()
        const userYear = user.project?.academicPeriod?.name?.trim().toLowerCase()
        return Boolean(targetYear && userYear && targetYear === userYear)
      }

      return false
    })

    return NextResponse.json({ announcements: audienceFiltered }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
