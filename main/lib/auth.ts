import { jwtVerify, SignJWT } from "jose"
import { prisma } from "@/lib/prisma"
import { logAudit } from "@/lib/audit"

export type JwtPayload = {
  sub: string
  email: string
  role: "STUDENT" | "SUPERVISOR" | "ADMIN"
  sessionVersion: number
  isImpersonating?: boolean
  actorSub?: string
  actorEmail?: string
  actorRole?: "STUDENT" | "SUPERVISOR" | "ADMIN"
  actorSessionVersion?: number
  impersonationSessionId?: string
}

type VerifyContext = {
  path?: string
  method?: string
}

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: {
  sub: string
  email: string
  role: JwtPayload["role"]
  sessionVersion: number
  isImpersonating?: boolean
  actorSub?: string
  actorEmail?: string
  actorRole?: JwtPayload["role"]
  actorSessionVersion?: number
  impersonationSessionId?: string
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret())
}

export async function verifyTokenFromHeader(
  authHeader: string | null,
  context?: VerifyContext
): Promise<JwtPayload | null> {
  if (!authHeader) return null

  const [type, token] = authHeader.split(" ")
  if (type !== "Bearer" || !token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    const tokenPayload = payload as Partial<JwtPayload>
    const hasImpersonationClaims =
      typeof tokenPayload.isImpersonating !== "undefined" ||
      typeof tokenPayload.actorSub !== "undefined" ||
      typeof tokenPayload.actorEmail !== "undefined" ||
      typeof tokenPayload.actorRole !== "undefined" ||
      typeof tokenPayload.actorSessionVersion !== "undefined" ||
      typeof tokenPayload.impersonationSessionId !== "undefined"

    if (
      typeof tokenPayload.sub !== "string" ||
      typeof tokenPayload.email !== "string" ||
      (tokenPayload.role !== "STUDENT" &&
        tokenPayload.role !== "SUPERVISOR" &&
        tokenPayload.role !== "ADMIN") ||
      typeof tokenPayload.sessionVersion !== "number"
    ) {
      return null
    }

    if (hasImpersonationClaims) {
      const impersonationClaimValid =
        tokenPayload.isImpersonating === true &&
        typeof tokenPayload.actorSub === "string" &&
        typeof tokenPayload.actorEmail === "string" &&
        (tokenPayload.actorRole === "STUDENT" ||
          tokenPayload.actorRole === "SUPERVISOR" ||
          tokenPayload.actorRole === "ADMIN") &&
        typeof tokenPayload.actorSessionVersion === "number" &&
        typeof tokenPayload.impersonationSessionId === "string"

      if (!impersonationClaimValid) {
        return null
      }
    }

    const user = await prisma.user.findUnique({
      where: { id: tokenPayload.sub },
      select: { status: true, sessionVersion: true },
    })

    if (
      !user ||
      user.status !== "ACTIVE" ||
      user.sessionVersion !== tokenPayload.sessionVersion
    ) {
      return null
    }

    if (tokenPayload.isImpersonating) {
      const actorUser = await prisma.user.findUnique({
        where: { id: tokenPayload.actorSub },
        select: {
          status: true,
          sessionVersion: true,
          role: true,
        },
      })

      if (
        !actorUser ||
        actorUser.status !== "ACTIVE" ||
        actorUser.sessionVersion !== tokenPayload.actorSessionVersion ||
        actorUser.role !== "ADMIN"
      ) {
        return null
      }

      try {
        const session = await (prisma as any).impersonationSession.findUnique({
          where: { id: tokenPayload.impersonationSessionId },
          select: {
            id: true,
            adminId: true,
            targetUserId: true,
            endedAt: true,
          },
        })

        if (
          !session ||
          session.endedAt ||
          session.adminId !== tokenPayload.actorSub ||
          session.targetUserId !== tokenPayload.sub
        ) {
          return null
        }
      } catch {
        return null
      }

      if (context?.path) {
        await logAudit({
          actorId: tokenPayload.actorSub,
          actorEmail: tokenPayload.actorEmail,
          actorRole: tokenPayload.actorRole,
          targetUserId: tokenPayload.sub,
          action: "impersonation_action",
          resource: context.path,
          metadata: {
            method: context.method || "UNKNOWN",
          },
          impersonationSessionId: tokenPayload.impersonationSessionId,
        })
      }
    }

    return tokenPayload as JwtPayload
  } catch {
    return null
  }
}

export function requireRole(
  payload: JwtPayload | null,
  role: JwtPayload["role"]
) {
  return payload?.role === role
}
