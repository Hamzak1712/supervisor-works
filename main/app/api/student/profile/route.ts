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

    const profile = await prisma.studentProfile.findUnique({
      where: { userId: payload.sub },
      select: {
        fullName: true,
        skills: true,
        interests: true,
      },
    })

    return NextResponse.json(
      {
        profile: profile ?? {
          fullName: null,
          skills: null,
          interests: null,
        },
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
      },
    })

    return NextResponse.json({ profile }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
