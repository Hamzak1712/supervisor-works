import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { verifyTokenFromHeader, requireRole } from "@/lib/auth"
import { generateRecommendationsForStudent } from "@/lib/matching-engine"

export async function GET(req: Request) {
  try {
    const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

    if (!payload) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!requireRole(payload, "STUDENT")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const result = await generateRecommendationsForStudent(prisma, payload.sub)

    return NextResponse.json(result, { status: 200 })
  } catch (err: any) {
    if (err?.message === "Create a project before running supervisor matching") {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }

    console.error(err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
