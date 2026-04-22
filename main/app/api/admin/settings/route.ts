import { createHash, randomBytes } from "crypto"
import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, verifyTokenFromHeader } from "@/lib/auth"
import { hasPermission } from "@/lib/rbac"
import { logAudit } from "@/lib/audit"

const db = prisma as any

function toInt(value: unknown, fallback: number, min = 0, max = 100000) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN
  if (!Number.isFinite(parsed)) return fallback
  const rounded = Math.round(parsed)
  if (rounded < min) return min
  if (rounded > max) return max
  return rounded
}

function toFloat(value: unknown, fallback: number, min = 0, max = 5) {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : NaN
  if (!Number.isFinite(parsed)) return fallback
  if (parsed < min) return min
  if (parsed > max) return max
  return parsed
}

function maskApiKey(value: string) {
  if (!value) return null
  const prefix = value.slice(0, 8)
  return `${prefix}***`
}

function keyHash(value: string) {
  return createHash("sha256").update(value).digest("hex")
}

async function requireAdmin(req: Request) {
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
    const permitted = await hasPermission(payload, "admin.settings.manage")
    if (!permitted) {
      return {
        ok: false as const,
        response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
      }
    }
  }

  return { ok: true as const, payload }
}

async function ensureSettings() {
  return db.platformSettings.upsert({
    where: { id: "global" },
    update: {},
    create: {
      id: "global",
      institutionName: "SupervisorMatch",
      platformDescription:
        "AI-powered supervisor matching and project planning platform for students, supervisors, and administrators.",
      supportEmail: "support@university.ac.uk",
      defaultLocale: "en",
      defaultTimezone: "Europe/London",
      themeMode: "dark",
      featureMessagingEnabled: true,
      featureMeetingsEnabled: true,
      featureAnnouncementsEnabled: true,
      featureAiExplanationsEnabled: true,
      smtpProvider: "sendgrid",
      aiProvider: "openai",
      aiModel: "gpt-5.2",
      aiTemperature: 0.2,
      aiRateLimitPerMin: 60,
      sessionTimeoutMinutes: 60,
      passwordMinLength: 12,
      twoFactorRequiredForAdmin: true,
      auditLoggingEnabled: true,
      loginAttemptLimit: 5,
      lockoutMinutes: 15,
    },
  })
}

async function payload() {
  const [settings, apiKeys] = await Promise.all([
    ensureSettings(),
    db.serviceApiKey.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        service: true,
        keyPrefix: true,
        lastUsedAt: true,
        revokedAt: true,
        createdAt: true,
        createdByEmail: true,
      },
    }),
  ])

  return {
    settings,
    apiKeys,
  }
}

export async function GET(req: Request) {
  try {
    const auth = await requireAdmin(req)
    if (!auth.ok) return auth.response
    const data = await payload()
    return NextResponse.json(data, { status: 200 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err?.message || "Server error" }, { status: 500 })
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

    const action = typeof body.action === "string" ? body.action.trim() : "save_settings"
    const current = await ensureSettings()

    if (action === "save_settings") {
      const institutionName =
        typeof body.institutionName === "string" && body.institutionName.trim()
          ? body.institutionName.trim()
          : current.institutionName

      const updated = await db.platformSettings.update({
        where: { id: "global" },
        data: {
          institutionName,
          institutionLogoUrl:
            typeof body.institutionLogoUrl === "string" ? body.institutionLogoUrl.trim() || null : current.institutionLogoUrl,
          institutionFaviconUrl:
            typeof body.institutionFaviconUrl === "string"
              ? body.institutionFaviconUrl.trim() || null
              : current.institutionFaviconUrl,
          platformDescription:
            typeof body.platformDescription === "string"
              ? body.platformDescription.trim() || null
              : current.platformDescription,
          supportEmail:
            typeof body.supportEmail === "string" ? body.supportEmail.trim() || null : current.supportEmail,
          defaultLocale:
            typeof body.defaultLocale === "string" && body.defaultLocale.trim()
              ? body.defaultLocale.trim()
              : current.defaultLocale,
          defaultTimezone:
            typeof body.defaultTimezone === "string" && body.defaultTimezone.trim()
              ? body.defaultTimezone.trim()
              : current.defaultTimezone,
          themeMode:
            typeof body.themeMode === "string" && ["dark", "light", "system"].includes(body.themeMode)
              ? body.themeMode
              : current.themeMode,
          featureMessagingEnabled:
            typeof body.featureMessagingEnabled === "boolean"
              ? body.featureMessagingEnabled
              : current.featureMessagingEnabled,
          featureMeetingsEnabled:
            typeof body.featureMeetingsEnabled === "boolean"
              ? body.featureMeetingsEnabled
              : current.featureMeetingsEnabled,
          featureAnnouncementsEnabled:
            typeof body.featureAnnouncementsEnabled === "boolean"
              ? body.featureAnnouncementsEnabled
              : current.featureAnnouncementsEnabled,
          featureAiExplanationsEnabled:
            typeof body.featureAiExplanationsEnabled === "boolean"
              ? body.featureAiExplanationsEnabled
              : current.featureAiExplanationsEnabled,
          smtpProvider:
            typeof body.smtpProvider === "string" && body.smtpProvider.trim()
              ? body.smtpProvider.trim()
              : current.smtpProvider,
          smtpHost: typeof body.smtpHost === "string" ? body.smtpHost.trim() || null : current.smtpHost,
          smtpPort:
            typeof body.smtpPort !== "undefined"
              ? toInt(body.smtpPort, current.smtpPort || 587, 1, 65535)
              : current.smtpPort,
          smtpUser: typeof body.smtpUser === "string" ? body.smtpUser.trim() || null : current.smtpUser,
          smtpApiKeyMasked:
            typeof body.smtpApiKey === "string" && body.smtpApiKey.trim()
              ? maskApiKey(body.smtpApiKey.trim())
              : current.smtpApiKeyMasked,
          aiProvider:
            typeof body.aiProvider === "string" && body.aiProvider.trim()
              ? body.aiProvider.trim()
              : current.aiProvider,
          aiModel: typeof body.aiModel === "string" ? body.aiModel.trim() || null : current.aiModel,
          aiTemperature:
            typeof body.aiTemperature !== "undefined"
              ? toFloat(body.aiTemperature, current.aiTemperature, 0, 2)
              : current.aiTemperature,
          aiRateLimitPerMin:
            typeof body.aiRateLimitPerMin !== "undefined"
              ? toInt(body.aiRateLimitPerMin, current.aiRateLimitPerMin, 1, 5000)
              : current.aiRateLimitPerMin,
          aiApiKeyMasked:
            typeof body.aiApiKey === "string" && body.aiApiKey.trim()
              ? maskApiKey(body.aiApiKey.trim())
              : current.aiApiKeyMasked,
          ssoProvider: typeof body.ssoProvider === "string" ? body.ssoProvider.trim() || null : current.ssoProvider,
          ssoEnabled: typeof body.ssoEnabled === "boolean" ? body.ssoEnabled : current.ssoEnabled,
          lmsProvider: typeof body.lmsProvider === "string" ? body.lmsProvider.trim() || null : current.lmsProvider,
          lmsEnabled: typeof body.lmsEnabled === "boolean" ? body.lmsEnabled : current.lmsEnabled,
          calendarProvider:
            typeof body.calendarProvider === "string" ? body.calendarProvider.trim() || null : current.calendarProvider,
          calendarEnabled:
            typeof body.calendarEnabled === "boolean" ? body.calendarEnabled : current.calendarEnabled,
          sessionTimeoutMinutes:
            typeof body.sessionTimeoutMinutes !== "undefined"
              ? toInt(body.sessionTimeoutMinutes, current.sessionTimeoutMinutes, 5, 1440)
              : current.sessionTimeoutMinutes,
          passwordMinLength:
            typeof body.passwordMinLength !== "undefined"
              ? toInt(body.passwordMinLength, current.passwordMinLength, 8, 64)
              : current.passwordMinLength,
          twoFactorRequiredForAdmin:
            typeof body.twoFactorRequiredForAdmin === "boolean"
              ? body.twoFactorRequiredForAdmin
              : current.twoFactorRequiredForAdmin,
          ipAllowList: typeof body.ipAllowList === "string" ? body.ipAllowList : current.ipAllowList,
          auditLoggingEnabled:
            typeof body.auditLoggingEnabled === "boolean"
              ? body.auditLoggingEnabled
              : current.auditLoggingEnabled,
          loginAttemptLimit:
            typeof body.loginAttemptLimit !== "undefined"
              ? toInt(body.loginAttemptLimit, current.loginAttemptLimit, 1, 50)
              : current.loginAttemptLimit,
          lockoutMinutes:
            typeof body.lockoutMinutes !== "undefined"
              ? toInt(body.lockoutMinutes, current.lockoutMinutes, 1, 1440)
              : current.lockoutMinutes,
          updatedById: auth.payload.sub,
          updatedByEmail: auth.payload.email,
        },
      })

      if (typeof body.featureAiExplanationsEnabled === "boolean") {
        await prisma.matchingConfig.upsert({
          where: { id: "global" },
          update: {
            aiExplanationEnabled: body.featureAiExplanationsEnabled,
          },
          create: {
            id: "global",
            aiExplanationEnabled: body.featureAiExplanationsEnabled,
          },
        })
      }

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "settings.update",
        resource: "platform_settings",
        resourceId: updated.id,
      })

      const data = await payload()
      return NextResponse.json(data, { status: 200 })
    }

    if (action === "generate_api_key") {
      const service = typeof body.service === "string" && body.service.trim() ? body.service.trim() : "internal"
      const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : `${service} key`
      const raw = `sk_live_${randomBytes(24).toString("hex")}`
      const created = await db.serviceApiKey.create({
        data: {
          name,
          service,
          keyPrefix: raw.slice(0, 12),
          keyHash: keyHash(raw),
          createdById: auth.payload.sub,
          createdByEmail: auth.payload.email,
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "settings.api_key_generate",
        resource: "service_api_key",
        resourceId: created.id,
        metadata: {
          service,
          name,
        },
      })

      const data = await payload()
      return NextResponse.json({ ...data, createdSecret: raw }, { status: 200 })
    }

    if (action === "rotate_api_key") {
      const keyId = typeof body.keyId === "string" ? body.keyId.trim() : ""
      if (!keyId) {
        return NextResponse.json({ error: "keyId is required" }, { status: 400 })
      }
      const raw = `sk_live_${randomBytes(24).toString("hex")}`
      const updated = await db.serviceApiKey.update({
        where: { id: keyId },
        data: {
          keyPrefix: raw.slice(0, 12),
          keyHash: keyHash(raw),
          revokedAt: null,
          createdById: auth.payload.sub,
          createdByEmail: auth.payload.email,
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "settings.api_key_rotate",
        resource: "service_api_key",
        resourceId: updated.id,
      })

      const data = await payload()
      return NextResponse.json({ ...data, createdSecret: raw }, { status: 200 })
    }

    if (action === "revoke_api_key") {
      const keyId = typeof body.keyId === "string" ? body.keyId.trim() : ""
      if (!keyId) {
        return NextResponse.json({ error: "keyId is required" }, { status: 400 })
      }
      await db.serviceApiKey.update({
        where: { id: keyId },
        data: {
          revokedAt: new Date(),
        },
      })

      await logAudit({
        actorId: auth.payload.sub,
        actorEmail: auth.payload.email,
        actorRole: auth.payload.role,
        action: "settings.api_key_revoke",
        resource: "service_api_key",
        resourceId: keyId,
      })

      const data = await payload()
      return NextResponse.json(data, { status: 200 })
    }

    return NextResponse.json({ error: "Unsupported action" }, { status: 400 })
  } catch (err: any) {
    console.error(err)
    return NextResponse.json({ error: err?.message || "Update failed" }, { status: 500 })
  }
}
