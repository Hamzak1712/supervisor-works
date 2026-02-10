import { NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"
import { signToken } from "@/lib/auth"
import { Role } from "@prisma/client"

type RegisterBody = {
  email: string
  password: string
  role: "STUDENT" | "SUPERVISOR"
  fullName?: string
  skills?: string
  interests?: string
  expertise?: string
  maxCapacity?: number
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export async function POST(req: Request) {
  try {
    const secret = process.env.JWT_SECRET
    if (!secret) {
      return NextResponse.json(
        { error: "JWT_SECRET not set" },
        { status: 500 }
      )
    }

    const body = (await req.json()) as Partial<RegisterBody>

    const email = body.email?.trim().toLowerCase()
    const password = body.password
    const role = body.role

    if (!email || !password || !role) {
      return NextResponse.json(
        { error: "email, password, and role are required" },
        { status: 400 }
      )
    }

    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      )
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      )
    }

    if (role !== "STUDENT" && role !== "SUPERVISOR") {
      return NextResponse.json({ error: "Invalid role" }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use" },
        { status: 409 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const createdUser = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: role === "STUDENT" ? Role.STUDENT : Role.SUPERVISOR,
        studentProfile:
          role === "STUDENT"
            ? {
                create: {
                  fullName: body.fullName ?? null,
                  skills: body.skills ?? null,
                  interests: body.interests ?? null,
                },
              }
            : undefined,
        supervisorProfile:
          role === "SUPERVISOR"
            ? {
                create: {
                  fullName: body.fullName ?? null,
                  expertise: body.expertise ?? null,
                  maxCapacity: body.maxCapacity ?? 5,
                },
              }
            : undefined,
      },
      select: {
        id: true,
        email: true,
        role: true,
      },
    })

    const token = await signToken({
      sub: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
    })

    return NextResponse.json({ token, user: createdUser }, { status: 201 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
