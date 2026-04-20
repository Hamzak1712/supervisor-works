import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "SUPERVISOR")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const requests = await prisma.supervisionRequest.findMany({
      where: {
        supervisorId: payload.sub,
      },
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
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
                skills: true,
                interests: true,
              },
            },
          },
        },
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            keywords: true,
            status: true,
          },
        },
      },
    })

    return NextResponse.json({ requests }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}