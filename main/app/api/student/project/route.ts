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

    const project = await prisma.project.findUnique({
      where: { studentId: payload.sub },
      select: {
        id: true,
        studentId: true,
        title: true,
        description: true,
        keywords: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json(
      {
        project: project ?? {
          id: null,
          studentId: payload.sub,
          title: null,
          description: null,
          keywords: null,
          status: "draft",
          createdAt: null,
          updatedAt: null,
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
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const title = typeof body.title === "string" ? body.title.trim() : null
    const description =
      typeof body.description === "string" ? body.description.trim() : null
    const keywords =
      typeof body.keywords === "string" ? body.keywords.trim() : null
    const status = typeof body.status === "string" ? body.status.trim() : "draft"

    const project = await prisma.project.upsert({
      where: { studentId: payload.sub },
      create: {
        studentId: payload.sub,
        title,
        description,
        keywords,
        status,
      },
      update: {
        title,
        description,
        keywords,
        status,
      },
      select: {
        id: true,
        studentId: true,
        title: true,
        description: true,
        keywords: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return NextResponse.json({ project }, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
