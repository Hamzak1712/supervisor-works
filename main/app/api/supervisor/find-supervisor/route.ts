import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const existingRequests = await prisma.supervisionRequest.findMany({
      where: {
        studentId: payload.sub,
      },
      select: {
        supervisorId: true,
        status: true,
      },
    })

    const requestMap = new Map(
      existingRequests.map((r) => [r.supervisorId, r.status])
    )

    const supervisors = await prisma.user.findMany({
      where: {
        role: "SUPERVISOR",
      },
      orderBy: {
        createdAt: "desc",
      },
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

    const data = supervisors.map((supervisor) => {
      const expertise =
        supervisor.supervisorProfile?.expertise
          ?.split(",")
          .map((item) => item.trim())
          .filter(Boolean) || []

      return {
        id: supervisor.id,
        email: supervisor.email,
        fullName: supervisor.supervisorProfile?.fullName || "Unnamed Supervisor",
        expertise,
        maxCapacity: supervisor.supervisorProfile?.maxCapacity ?? 5,
        requestStatus: requestMap.get(supervisor.id) || null,
      }
    })

    return NextResponse.json({ supervisors: data }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}