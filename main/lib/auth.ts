import { jwtVerify, SignJWT } from "jose"
import { prisma } from "@/lib/prisma"

export type JwtPayload = {
  sub: string
  email: string
  role: "STUDENT" | "SUPERVISOR" | "ADMIN"
  sessionVersion: number
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
}): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecret())
}

export async function verifyTokenFromHeader(
  authHeader: string | null
): Promise<JwtPayload | null> {
  if (!authHeader) return null

  const [type, token] = authHeader.split(" ")
  if (type !== "Bearer" || !token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret())
    const tokenPayload = payload as Partial<JwtPayload>

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
