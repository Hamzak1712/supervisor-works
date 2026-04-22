import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader } from "@/lib/auth"

const db = prisma as any

export async function GET(req: Request) {
  try {
    const tokenData = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

    if (!tokenData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await db.user.findUnique({
      where: { id: tokenData.sub },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        studentProfile: {
          select: {
            fullName: true,
            skills: true,
            interests: true,
            onboardingCompleted: true,
          },
        },
        supervisorProfile: {
          select: {
            fullName: true,
            expertise: true,
            maxCapacity: true,
            onboardingCompleted: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const needsOnboarding =
      (user.role === "STUDENT" &&
        user.studentProfile?.onboardingCompleted === false) ||
      (user.role === "SUPERVISOR" &&
        user.supervisorProfile?.onboardingCompleted !== true)

    return NextResponse.json(
      {
        user,
        needsOnboarding,
        impersonation: tokenData.isImpersonating
          ? {
              isImpersonating: true,
              actorSub: tokenData.actorSub || null,
              actorEmail: tokenData.actorEmail || null,
              actorRole: tokenData.actorRole || null,
              sessionId: tokenData.impersonationSessionId || null,
            }
          : null,
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
