import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import { autoArchiveCompletedAcademicPeriods } from "@/lib/academic-periods"

async function requireAdmin(req: Request) {
  const payload = await verifyTokenFromHeader(req.headers.get("authorization"), { path: new URL(req.url).pathname, method: req.method })

  if (!payload) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (!requireRole(payload, "ADMIN")) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { ok: true as const, payload }
}

function parseDate(value: unknown, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date`)
  }

  return parsed
}

function parseOptionalDate(value: unknown, fieldName: string) {
  if (value === null || value === undefined || value === "") {
    return null
  }

  if (typeof value !== "string") {
    throw new Error(`${fieldName} must be a valid date`)
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`${fieldName} must be a valid date`)
  }

  return parsed
}

function validateDates(input: {
  startDate: Date
  endDate: Date
  projectEndPolicyAt: Date | null
  requestSupervisorCutoffAt: Date | null
  proposalSubmissionCutoffAt: Date | null
  finalSubmissionAt: Date | null
}) {
  const {
    startDate,
    endDate,
    projectEndPolicyAt,
    requestSupervisorCutoffAt,
    proposalSubmissionCutoffAt,
    finalSubmissionAt,
  } = input

  if (startDate >= endDate) {
    throw new Error("startDate must be before endDate")
  }

  const boundedDates = [
    { label: "projectEndPolicyAt", value: projectEndPolicyAt },
    { label: "requestSupervisorCutoffAt", value: requestSupervisorCutoffAt },
    { label: "proposalSubmissionCutoffAt", value: proposalSubmissionCutoffAt },
    { label: "finalSubmissionAt", value: finalSubmissionAt },
  ]

  boundedDates.forEach((item) => {
    if (!item.value) return
    if (item.value < startDate || item.value > endDate) {
      throw new Error(`${item.label} must fall within the period dates`)
    }
  })

  if (
    requestSupervisorCutoffAt &&
    proposalSubmissionCutoffAt &&
    requestSupervisorCutoffAt > proposalSubmissionCutoffAt
  ) {
    throw new Error(
      "requestSupervisorCutoffAt must be on or before proposalSubmissionCutoffAt"
    )
  }

  if (
    proposalSubmissionCutoffAt &&
    finalSubmissionAt &&
    proposalSubmissionCutoffAt > finalSubmissionAt
  ) {
    throw new Error(
      "proposalSubmissionCutoffAt must be on or before finalSubmissionAt"
    )
  }
}

async function payload() {
  await autoArchiveCompletedAcademicPeriods(prisma)

  const periods = await prisma.academicPeriod.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
    select: {
      id: true,
      name: true,
      startDate: true,
      endDate: true,
      projectEndPolicyAt: true,
      requestSupervisorCutoffAt: true,
      proposalSubmissionCutoffAt: true,
      finalSubmissionAt: true,
      isActive: true,
      isArchived: true,
      archivedAt: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  const activePeriod = periods.find((period) => period.isActive) || null

  return {
    periods,
    activePeriodId: activePeriod?.id || null,
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const data = await payload()
    return NextResponse.json(data, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)

    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const name = typeof body.name === "string" ? body.name.trim() : ""

    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 })
    }

    const startDate = parseDate(body.startDate, "startDate")
    const endDate = parseDate(body.endDate, "endDate")
    const projectEndPolicyAt = parseOptionalDate(
      body.projectEndPolicyAt,
      "projectEndPolicyAt"
    )
    const requestSupervisorCutoffAt = parseOptionalDate(
      body.requestSupervisorCutoffAt,
      "requestSupervisorCutoffAt"
    )
    const proposalSubmissionCutoffAt = parseOptionalDate(
      body.proposalSubmissionCutoffAt,
      "proposalSubmissionCutoffAt"
    )
    const finalSubmissionAt = parseOptionalDate(
      body.finalSubmissionAt,
      "finalSubmissionAt"
    )

    validateDates({
      startDate,
      endDate,
      projectEndPolicyAt,
      requestSupervisorCutoffAt,
      proposalSubmissionCutoffAt,
      finalSubmissionAt,
    })

    const hasActive = await prisma.academicPeriod.findFirst({
      where: {
        isActive: true,
        isArchived: false,
      },
      select: { id: true },
    })

    await prisma.academicPeriod.create({
      data: {
        name,
        startDate,
        endDate,
        projectEndPolicyAt,
        requestSupervisorCutoffAt,
        proposalSubmissionCutoffAt,
        finalSubmissionAt,
        isActive: !hasActive,
      },
    })

    const data = await payload()
    return NextResponse.json(data, { status: 201 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json(
      { error: err?.message || "Create failed" },
      { status: 400 }
    )
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.trim() : ""
    const periodId =
      typeof body.periodId === "string" ? body.periodId.trim() : ""

    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    if (!periodId) {
      return NextResponse.json({ error: "periodId is required" }, { status: 400 })
    }

    const existing = await prisma.academicPeriod.findUnique({
      where: { id: periodId },
      select: { id: true, isArchived: true },
    })

    if (!existing) {
      return NextResponse.json({ error: "Period not found" }, { status: 404 })
    }

    if (action === "update_period") {
      if (existing.isArchived) {
        return NextResponse.json(
          { error: "Archived periods are read-only" },
          { status: 400 }
        )
      }

      const name = typeof body.name === "string" ? body.name.trim() : ""

      if (!name) {
        return NextResponse.json({ error: "name is required" }, { status: 400 })
      }

      const startDate = parseDate(body.startDate, "startDate")
      const endDate = parseDate(body.endDate, "endDate")
      const projectEndPolicyAt = parseOptionalDate(
        body.projectEndPolicyAt,
        "projectEndPolicyAt"
      )
      const requestSupervisorCutoffAt = parseOptionalDate(
        body.requestSupervisorCutoffAt,
        "requestSupervisorCutoffAt"
      )
      const proposalSubmissionCutoffAt = parseOptionalDate(
        body.proposalSubmissionCutoffAt,
        "proposalSubmissionCutoffAt"
      )
      const finalSubmissionAt = parseOptionalDate(
        body.finalSubmissionAt,
        "finalSubmissionAt"
      )

      validateDates({
        startDate,
        endDate,
        projectEndPolicyAt,
        requestSupervisorCutoffAt,
        proposalSubmissionCutoffAt,
        finalSubmissionAt,
      })

      await prisma.academicPeriod.update({
        where: { id: periodId },
        data: {
          name,
          startDate,
          endDate,
          projectEndPolicyAt,
          requestSupervisorCutoffAt,
          proposalSubmissionCutoffAt,
          finalSubmissionAt,
        },
      })
    } else if (action === "set_active_period") {
      if (existing.isArchived) {
        return NextResponse.json(
          { error: "Archived periods cannot be activated" },
          { status: 400 }
        )
      }

      await prisma.$transaction([
        prisma.academicPeriod.updateMany({
          where: { isActive: true },
          data: { isActive: false },
        }),
        prisma.academicPeriod.update({
          where: { id: periodId },
          data: { isActive: true, isArchived: false, archivedAt: null },
        }),
      ])
    } else if (action === "archive_period") {
      await prisma.academicPeriod.update({
        where: { id: periodId },
        data: {
          isArchived: true,
          isActive: false,
          archivedAt: new Date(),
        },
      })
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const data = await payload()
    return NextResponse.json(data, { status: 200 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json(
      { error: err?.message || "Update failed" },
      { status: 400 }
    )
  }
}

