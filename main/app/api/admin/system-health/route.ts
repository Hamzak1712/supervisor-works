import os from "node:os"
import { statfs } from "node:fs/promises"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { logAudit } from "@/lib/audit"

const db = prisma as any
const DAY_MS = 24 * 60 * 60 * 1000

type ServiceStatus = "operational" | "degraded" | "down"

type LiveService = {
  serviceKey: "db" | "api" | "ai" | "email" | "storage"
  serviceName: string
  status: ServiceStatus
  responseMs: number
  requestPerMin: number | null
  errorRatePercent: number | null
  queueDepth: number | null
  details?: string
}

function toInt(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(min, Math.min(max, Math.floor(value)))
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(min, Math.min(max, Math.floor(parsed)))
    }
  }
  return null
}

function toFloat(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(min, Math.min(max, value))
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return Math.max(min, Math.min(max, parsed))
    }
  }
  return null
}

function parseDateInput(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

async function requireAdminWithPermission(req: Request, permissionKey: string) {
  const payload = await verifyTokenFromHeader(req.headers.get("authorization"), {
    path: new URL(req.url).pathname,
    method: req.method,
  })

  if (!payload) {
    return {
      ok: false as const,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  if (!requireRole(payload, "ADMIN")) {
    const permitted = await hasPermission(payload, permissionKey)
    if (permitted) {
      return { ok: true as const, payload }
    }

    return {
      ok: false as const,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    }
  }

  return { ok: true as const, payload }
}

async function ensureConfig() {
  const [config, signal] = await Promise.all([
    db.systemHealthConfig.upsert({
      where: { id: "global" },
      update: {},
      create: {
        id: "global",
        errorRateSpikeThreshold: 5,
        queueDepthWarning: 25,
        queueDepthCritical: 60,
        maintenanceBannerLeadMin: 120,
      },
    }),
    db.systemHealthSignal.upsert({
      where: { id: "global" },
      update: {},
      create: {
        id: "global",
        apiRequestsLast5m: 1,
        api5xxLast5m: 0,
        aiQueueDepth: 0,
        emailQueueDepth: 0,
      },
    }),
  ])

  return { config, signal }
}

async function checkDatabase(): Promise<{ status: ServiceStatus; responseMs: number; details?: string }> {
  const started = Date.now()
  try {
    await prisma.$queryRawUnsafe("SELECT 1")
    const responseMs = Date.now() - started
    return {
      status: responseMs > 800 ? "degraded" : "operational",
      responseMs,
    }
  } catch (err: any) {
    return {
      status: "down",
      responseMs: Date.now() - started,
      details: err?.message || "Database check failed",
    }
  }
}

async function checkApi(req: Request): Promise<{ status: ServiceStatus; responseMs: number; details?: string }> {
  const started = Date.now()
  try {
    const url = new URL("/api/health", req.url).toString()
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeout)

    const responseMs = Date.now() - started
    if (!res.ok) {
      return {
        status: "degraded",
        responseMs,
        details: `Health endpoint returned ${res.status}`,
      }
    }

    return {
      status: responseMs > 1000 ? "degraded" : "operational",
      responseMs,
    }
  } catch (err: any) {
    return {
      status: "down",
      responseMs: Date.now() - started,
      details: err?.message || "API health check failed",
    }
  }
}

async function checkAiService(): Promise<{ status: ServiceStatus; responseMs: number; details?: string }> {
  const started = Date.now()
  const aiUrl = process.env.AI_SERVICE_URL?.trim()

  if (!aiUrl) {
    return {
      status: "degraded",
      responseMs: 0,
      details: "AI_SERVICE_URL is not configured",
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 2500)
    const res = await fetch(aiUrl, {
      method: "GET",
      signal: controller.signal,
      cache: "no-store",
    })
    clearTimeout(timeout)
    const responseMs = Date.now() - started

    if (!res.ok) {
      return {
        status: "degraded",
        responseMs,
        details: `AI service returned ${res.status}`,
      }
    }

    return {
      status: responseMs > 1200 ? "degraded" : "operational",
      responseMs,
    }
  } catch (err: any) {
    return {
      status: "down",
      responseMs: Date.now() - started,
      details: err?.message || "AI service check failed",
    }
  }
}

async function checkEmailGateway(signal: { emailQueueDepth: number }) {
  const started = Date.now()
  const hasProvider =
    Boolean(process.env.SMTP_HOST?.trim()) ||
    Boolean(process.env.SENDGRID_API_KEY?.trim()) ||
    Boolean(process.env.RESEND_API_KEY?.trim()) ||
    Boolean(process.env.MAILGUN_API_KEY?.trim())

  const responseMs = Date.now() - started
  if (!hasProvider) {
    return {
      status: "degraded" as ServiceStatus,
      responseMs,
      details: "No SMTP/API email provider is configured",
      queueDepth: signal.emailQueueDepth,
    }
  }

  return {
    status: signal.emailQueueDepth > 100 ? ("degraded" as ServiceStatus) : ("operational" as ServiceStatus),
    responseMs,
    details: signal.emailQueueDepth > 100 ? "Email queue backlog is elevated" : undefined,
    queueDepth: signal.emailQueueDepth,
  }
}

async function checkStorage(): Promise<{
  status: ServiceStatus
  responseMs: number
  details?: string
  storagePercent: number | null
}> {
  const started = Date.now()
  try {
    const disk = await statfs(process.cwd())
    const responseMs = Date.now() - started
    const totalBlocks = Number(disk.blocks || 0)
    const freeBlocks = Number(disk.bfree || 0)
    let storagePercent: number | null = null
    if (totalBlocks > 0) {
      storagePercent = ((totalBlocks - freeBlocks) / totalBlocks) * 100
    }

    const status: ServiceStatus =
      storagePercent !== null && storagePercent >= 95
        ? "down"
        : storagePercent !== null && storagePercent >= 85
          ? "degraded"
          : "operational"

    return {
      status,
      responseMs,
      storagePercent,
      details:
        storagePercent !== null && storagePercent >= 85
          ? `Storage usage is high (${storagePercent.toFixed(1)}%)`
          : undefined,
    }
  } catch (err: any) {
    return {
      status: "degraded",
      responseMs: Date.now() - started,
      details: err?.message || "Storage check unavailable",
      storagePercent: null,
    }
  }
}

async function getDbConnections() {
  try {
    const rows = (await prisma.$queryRawUnsafe(
      "SELECT COUNT(*)::int AS count FROM pg_stat_activity"
    )) as Array<{ count: number }>
    return rows?.[0]?.count ?? null
  } catch {
    return null
  }
}

function computeResourceMetrics(storagePercent: number | null, dbConnections: number | null) {
  const cpuCount = Math.max(1, os.cpus().length)
  const oneMinLoad = os.loadavg()[0]
  const cpuPercent = Math.max(0, Math.min(100, (oneMinLoad / cpuCount) * 100))
  const memoryPercent = Math.max(
    0,
    Math.min(100, (process.memoryUsage().rss / os.totalmem()) * 100)
  )

  return {
    cpuPercent,
    memoryPercent,
    storagePercent,
    dbConnections,
  }
}

function formatStatusCounts(services: LiveService[]) {
  return {
    operational: services.filter((s) => s.status === "operational").length,
    degraded: services.filter((s) => s.status === "degraded").length,
    down: services.filter((s) => s.status === "down").length,
  }
}

function bucketByInterval(
  snapshots: Array<{
    createdAt: Date
    responseMs: number
    status: string
  }>,
  fromMs: number,
  bucketMs: number,
  pointCount: number
) {
  const points: Array<{
    timestamp: string
    avgResponseMs: number
    uptimePercent: number
  }> = []

  for (let i = 0; i < pointCount; i += 1) {
    const start = fromMs + i * bucketMs
    const end = start + bucketMs
    const inBucket = snapshots.filter((item) => {
      const t = item.createdAt.getTime()
      return t >= start && t < end
    })

    const avgResponseMs =
      inBucket.length > 0
        ? Math.round(inBucket.reduce((sum, item) => sum + item.responseMs, 0) / inBucket.length)
        : 0
    const uptimePercent =
      inBucket.length > 0
        ? (inBucket.filter((item) => item.status !== "down").length / inBucket.length) * 100
        : 0

    points.push({
      timestamp: new Date(start).toISOString(),
      avgResponseMs,
      uptimePercent: Number(uptimePercent.toFixed(2)),
    })
  }

  return points
}

async function getPayload(req: Request, forceSnapshot = false) {
  const [{ config, signal }, dbCheck, apiCheck, aiCheck, storageCheck, dbConnections] =
    await Promise.all([
      ensureConfig(),
      checkDatabase(),
      checkApi(req),
      checkAiService(),
      checkStorage(),
      getDbConnections(),
    ])

  const resources = computeResourceMetrics(storageCheck.storagePercent, dbConnections)
  const errorRatePercent =
    signal.apiRequestsLast5m > 0
      ? (signal.api5xxLast5m / signal.apiRequestsLast5m) * 100
      : 0
  const requestPerMin = Math.max(0, Math.round(signal.apiRequestsLast5m / 5))

  const emailCheck = await checkEmailGateway(signal)

  const services: LiveService[] = [
    {
      serviceKey: "db",
      serviceName: "Database",
      status: dbCheck.status,
      responseMs: dbCheck.responseMs,
      requestPerMin,
      errorRatePercent,
      queueDepth: null,
      details: dbCheck.details,
    },
    {
      serviceKey: "api",
      serviceName: "API",
      status: apiCheck.status,
      responseMs: apiCheck.responseMs,
      requestPerMin,
      errorRatePercent,
      queueDepth: null,
      details: apiCheck.details,
    },
    {
      serviceKey: "ai",
      serviceName: "AI Microservice",
      status:
        signal.aiQueueDepth >= config.queueDepthCritical
          ? "down"
          : signal.aiQueueDepth >= config.queueDepthWarning && aiCheck.status === "operational"
            ? "degraded"
            : aiCheck.status,
      responseMs: aiCheck.responseMs,
      requestPerMin,
      errorRatePercent,
      queueDepth: signal.aiQueueDepth,
      details:
        signal.aiQueueDepth >= config.queueDepthWarning
          ? `Queue depth is ${signal.aiQueueDepth}`
          : aiCheck.details,
    },
    {
      serviceKey: "email",
      serviceName: "Email Gateway",
      status: emailCheck.status,
      responseMs: emailCheck.responseMs,
      requestPerMin,
      errorRatePercent: null,
      queueDepth: emailCheck.queueDepth,
      details: emailCheck.details,
    },
    {
      serviceKey: "storage",
      serviceName: "File Storage",
      status: storageCheck.status,
      responseMs: storageCheck.responseMs,
      requestPerMin,
      errorRatePercent: null,
      queueDepth: null,
      details: storageCheck.details,
    },
  ]

  const latestSnapshots = (await db.serviceHealthSnapshot.findMany({
    where: {
      createdAt: {
        gte: new Date(Date.now() - 60_000),
      },
    },
    select: {
      serviceKey: true,
    },
  })) as Array<{ serviceKey: string }>

  const existingRecentServiceKeys = new Set(latestSnapshots.map((item) => item.serviceKey))

  if (forceSnapshot || existingRecentServiceKeys.size < services.length) {
    const records = services.filter((service) => forceSnapshot || !existingRecentServiceKeys.has(service.serviceKey))
    if (records.length > 0) {
      await db.serviceHealthSnapshot.createMany({
        data: records.map((service) => ({
          serviceKey: service.serviceKey,
          serviceName: service.serviceName,
          status: service.status,
          responseMs: service.responseMs,
          requestPerMin: service.requestPerMin,
          errorRatePercent: service.errorRatePercent,
          queueDepth: service.queueDepth,
          cpuPercent: resources.cpuPercent,
          memoryPercent: resources.memoryPercent,
          storagePercent: resources.storagePercent,
          dbConnections: resources.dbConnections,
        })),
      })
    }
  }

  const now = Date.now()
  const snapshots = (await db.serviceHealthSnapshot.findMany({
    where: {
      createdAt: {
        gte: new Date(now - 30 * DAY_MS),
      },
    },
    orderBy: {
      createdAt: "asc",
    },
    select: {
      serviceKey: true,
      createdAt: true,
      responseMs: true,
      status: true,
    },
  })) as Array<{
    serviceKey: string
    createdAt: Date
    responseMs: number
    status: string
  }>

  const incidents = (await db.serviceIncident.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
    select: {
      id: true,
      serviceKey: true,
      title: true,
      severity: true,
      status: true,
      ownerEmail: true,
      description: true,
      resolutionNotes: true,
      createdAt: true,
      updatedAt: true,
      resolvedAt: true,
      createdBy: {
        select: {
          email: true,
        },
      },
    },
  })) as Array<{
    id: string
    serviceKey: string
    title: string
    severity: string
    status: string
    ownerEmail: string | null
    description: string | null
    resolutionNotes: string | null
    createdAt: Date
    updatedAt: Date
    resolvedAt: Date | null
    createdBy: {
      email: string
    } | null
  }>

  const maintenanceWindows = (await db.maintenanceWindow.findMany({
    orderBy: {
      startsAt: "asc",
    },
    take: 100,
    select: {
      id: true,
      title: true,
      message: true,
      impact: true,
      startsAt: true,
      endsAt: true,
      createdAt: true,
      createdBy: {
        select: {
          email: true,
        },
      },
    },
  })) as Array<{
    id: string
    title: string
    message: string
    impact: string | null
    startsAt: Date
    endsAt: Date
    createdAt: Date
    createdBy: {
      email: string
    } | null
  }>

  const trends: Record<
    string,
    {
      h24: Array<{ timestamp: string; avgResponseMs: number; uptimePercent: number }>
      d7: Array<{ timestamp: string; avgResponseMs: number; uptimePercent: number }>
      d30: Array<{ timestamp: string; avgResponseMs: number; uptimePercent: number }>
    }
  > = {}

  for (const service of services) {
    const series = snapshots.filter((item) => item.serviceKey === service.serviceKey)
    trends[service.serviceKey] = {
      h24: bucketByInterval(series, now - DAY_MS, 60 * 60 * 1000, 24),
      d7: bucketByInterval(series, now - 7 * DAY_MS, DAY_MS, 7),
      d30: bucketByInterval(series, now - 30 * DAY_MS, DAY_MS, 30),
    }
  }

  const statusCounts = formatStatusCounts(services)
  const errorSpike = errorRatePercent >= config.errorRateSpikeThreshold
  const queueSpike = signal.aiQueueDepth >= config.queueDepthWarning

  return {
    generatedAt: new Date().toISOString(),
    services,
    resources,
    statusCounts,
    config,
    signal,
    alerts: {
      errorSpike,
      queueSpike,
      errorRatePercent: Number(errorRatePercent.toFixed(2)),
      queueDepth: signal.aiQueueDepth,
    },
    incidents: incidents.map((item) => ({
      ...item,
      createdByEmail: item.createdBy?.email || null,
    })),
    maintenanceWindows: maintenanceWindows.map((item) => ({
      ...item,
      createdByEmail: item.createdBy?.email || null,
      activeNow: item.startsAt <= new Date() && item.endsAt >= new Date(),
      startsSoon:
        item.startsAt > new Date() &&
        item.startsAt.getTime() <=
          Date.now() + config.maintenanceBannerLeadMin * 60 * 1000,
    })),
    trends,
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdminWithPermission(req, "admin.system_health.read")
    if (!auth.ok) return auth.response

    const payload = await getPayload(req)
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function PUT(req: Request) {
  try {
    const auth = await requireAdminWithPermission(req, "admin.system_health.manage")
    if (!auth.ok) return auth.response

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const action = typeof body.action === "string" ? body.action.trim() : ""
    if (!action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    if (action === "create_incident") {
      const serviceKey =
        typeof body.serviceKey === "string" ? body.serviceKey.trim().toLowerCase() : ""
      const title = typeof body.title === "string" ? body.title.trim() : ""
      const severity =
        typeof body.severity === "string" ? body.severity.trim().toLowerCase() : ""
      const status =
        typeof body.status === "string" ? body.status.trim().toLowerCase() : "open"
      const ownerEmail =
        typeof body.ownerEmail === "string" ? body.ownerEmail.trim().toLowerCase() : ""
      const description =
        typeof body.description === "string" ? body.description.trim() : ""

      if (!serviceKey || !title) {
        return NextResponse.json(
          { error: "serviceKey and title are required" },
          { status: 400 }
        )
      }

      if (!["low", "medium", "high", "critical"].includes(severity)) {
        return NextResponse.json(
          { error: "severity must be low, medium, high or critical" },
          { status: 400 }
        )
      }

      if (!["open", "investigating", "monitoring", "resolved"].includes(status)) {
        return NextResponse.json(
          { error: "status must be open, investigating, monitoring or resolved" },
          { status: 400 }
        )
      }

      await db.serviceIncident.create({
        data: {
          serviceKey,
          title,
          severity,
          status,
          ownerEmail: ownerEmail || null,
          description: description || null,
          createdById: auth.payload.sub,
          resolvedAt: status === "resolved" ? new Date() : null,
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "incident_created",
        resource: "service_incident",
        metadata: {
          serviceKey,
          severity,
        },
      })
    } else if (action === "update_incident") {
      const incidentId = typeof body.incidentId === "string" ? body.incidentId.trim() : ""
      if (!incidentId) {
        return NextResponse.json(
          { error: "incidentId is required" },
          { status: 400 }
        )
      }

      const severity =
        typeof body.severity === "string" ? body.severity.trim().toLowerCase() : null
      const status =
        typeof body.status === "string" ? body.status.trim().toLowerCase() : null
      const ownerEmail =
        typeof body.ownerEmail === "string" ? body.ownerEmail.trim().toLowerCase() : null
      const resolutionNotes =
        typeof body.resolutionNotes === "string" ? body.resolutionNotes.trim() : null
      const title = typeof body.title === "string" ? body.title.trim() : null
      const description =
        typeof body.description === "string" ? body.description.trim() : null

      const data: Record<string, unknown> = {}

      if (severity) {
        if (!["low", "medium", "high", "critical"].includes(severity)) {
          return NextResponse.json(
            { error: "invalid severity" },
            { status: 400 }
          )
        }
        data.severity = severity
      }

      if (status) {
        if (!["open", "investigating", "monitoring", "resolved"].includes(status)) {
          return NextResponse.json(
            { error: "invalid status" },
            { status: 400 }
          )
        }
        data.status = status
        data.resolvedAt = status === "resolved" ? new Date() : null
      }

      if (ownerEmail !== null) data.ownerEmail = ownerEmail || null
      if (resolutionNotes !== null) data.resolutionNotes = resolutionNotes || null
      if (title !== null) data.title = title || null
      if (description !== null) data.description = description || null

      await db.serviceIncident.update({
        where: {
          id: incidentId,
        },
        data,
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "incident_updated",
        resource: "service_incident",
        resourceId: incidentId,
      })
    } else if (action === "create_maintenance_window") {
      const title = typeof body.title === "string" ? body.title.trim() : ""
      const message = typeof body.message === "string" ? body.message.trim() : ""
      const impact = typeof body.impact === "string" ? body.impact.trim() : ""
      const startsAt = parseDateInput(body.startsAt)
      const endsAt = parseDateInput(body.endsAt)

      if (!title || !message || !startsAt || !endsAt) {
        return NextResponse.json(
          { error: "title, message, startsAt and endsAt are required" },
          { status: 400 }
        )
      }

      if (endsAt <= startsAt) {
        return NextResponse.json(
          { error: "endsAt must be after startsAt" },
          { status: 400 }
        )
      }

      await db.maintenanceWindow.create({
        data: {
          title,
          message,
          impact: impact || null,
          startsAt,
          endsAt,
          createdById: auth.payload.sub,
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "maintenance_window_created",
        resource: "maintenance_window",
      })
    } else if (action === "delete_maintenance_window") {
      const windowId = typeof body.windowId === "string" ? body.windowId.trim() : ""
      if (!windowId) {
        return NextResponse.json({ error: "windowId is required" }, { status: 400 })
      }

      await db.maintenanceWindow.delete({
        where: { id: windowId },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "maintenance_window_deleted",
        resource: "maintenance_window",
        resourceId: windowId,
      })
    } else if (action === "update_config") {
      const errorRateSpikeThreshold = toFloat(body.errorRateSpikeThreshold, 0, 100)
      const queueDepthWarning = toInt(body.queueDepthWarning, 1, 100000)
      const queueDepthCritical = toInt(body.queueDepthCritical, 1, 100000)
      const maintenanceBannerLeadMin = toInt(body.maintenanceBannerLeadMin, 0, 10080)

      if (
        errorRateSpikeThreshold === null ||
        queueDepthWarning === null ||
        queueDepthCritical === null ||
        maintenanceBannerLeadMin === null
      ) {
        return NextResponse.json(
          {
            error:
              "errorRateSpikeThreshold, queueDepthWarning, queueDepthCritical and maintenanceBannerLeadMin are required",
          },
          { status: 400 }
        )
      }

      if (queueDepthCritical < queueDepthWarning) {
        return NextResponse.json(
          { error: "queueDepthCritical must be greater than or equal to queueDepthWarning" },
          { status: 400 }
        )
      }

      await db.systemHealthConfig.upsert({
        where: { id: "global" },
        update: {
          errorRateSpikeThreshold,
          queueDepthWarning,
          queueDepthCritical,
          maintenanceBannerLeadMin,
        },
        create: {
          id: "global",
          errorRateSpikeThreshold,
          queueDepthWarning,
          queueDepthCritical,
          maintenanceBannerLeadMin,
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "system_health_config_updated",
        resource: "system_health_config",
      })
    } else if (action === "update_signal") {
      const apiRequestsLast5m = toInt(body.apiRequestsLast5m, 0, 1_000_000)
      const api5xxLast5m = toInt(body.api5xxLast5m, 0, 1_000_000)
      const aiQueueDepth = toInt(body.aiQueueDepth, 0, 1_000_000)
      const emailQueueDepth = toInt(body.emailQueueDepth, 0, 1_000_000)

      if (
        apiRequestsLast5m === null &&
        api5xxLast5m === null &&
        aiQueueDepth === null &&
        emailQueueDepth === null
      ) {
        return NextResponse.json(
          { error: "At least one signal field must be provided" },
          { status: 400 }
        )
      }

      await db.systemHealthSignal.upsert({
        where: { id: "global" },
        update: {
          ...(apiRequestsLast5m !== null ? { apiRequestsLast5m } : {}),
          ...(api5xxLast5m !== null ? { api5xxLast5m } : {}),
          ...(aiQueueDepth !== null ? { aiQueueDepth } : {}),
          ...(emailQueueDepth !== null ? { emailQueueDepth } : {}),
        },
        create: {
          id: "global",
          apiRequestsLast5m: apiRequestsLast5m ?? 1,
          api5xxLast5m: api5xxLast5m ?? 0,
          aiQueueDepth: aiQueueDepth ?? 0,
          emailQueueDepth: emailQueueDepth ?? 0,
        },
      })
    } else if (action === "run_health_scan") {
      const payload = await getPayload(req, true)
      return NextResponse.json(payload, { status: 200 })
    } else {
      return NextResponse.json({ error: "Unknown action" }, { status: 400 })
    }

    const payload = await getPayload(req)
    return NextResponse.json(payload, { status: 200 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
