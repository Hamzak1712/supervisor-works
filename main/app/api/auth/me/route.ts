import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader } from "@/lib/auth"

export async function GET(req: Request) {
  try {
    const tokenData = await verifyTokenFromHeader(req.headers.get("authorization"))

    if (!tokenData) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenData.sub },
      select: {
        id: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        studentProfile: {
          select: { fullName: true, skills: true, interests: true },
        },
        supervisorProfile: {
          select: { fullName: true, expertise: true, maxCapacity: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    return NextResponse.json({ user }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
