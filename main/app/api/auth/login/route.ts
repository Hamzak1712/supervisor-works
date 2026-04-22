import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { signToken } from "@/lib/auth"

const db = prisma as any

type LoginBody = {
  email?: string
  password?: string
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody

    const email = body.email?.trim().toLowerCase()
    const password = body.password

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      )
    }

    const user = await db.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        sessionVersion: true,
        studentProfile: {
          select: {
            onboardingCompleted: true,
          },
        },
        supervisorProfile: {
          select: {
            onboardingCompleted: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    const ok = await bcrypt.compare(password, user.passwordHash)
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 }
      )
    }

    if (user.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Your account is suspended. Contact an administrator." },
        { status: 403 }
      )
    }

    if (user.status === "PENDING") {
      return NextResponse.json(
        { error: "Your account invitation is pending activation." },
        { status: 403 }
      )
    }

    const token = await signToken({
      sub: user.id,
      role: user.role,
      email: user.email,
      sessionVersion: user.sessionVersion,
    })

    const needsStudentOnboarding =
      user.role === "STUDENT" &&
      user.studentProfile?.onboardingCompleted === false

    const needsSupervisorOnboarding =
      user.role === "SUPERVISOR" &&
      user.supervisorProfile?.onboardingCompleted !== true

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      needsOnboarding: needsStudentOnboarding || needsSupervisorOnboarding,
    })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
