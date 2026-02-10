import { jwtVerify, SignJWT } from "jose"

export type JwtPayload = {
  sub: string
  email: string
  role: "STUDENT" | "SUPERVISOR" | "ADMIN"
}

function getSecret() {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error("JWT_SECRET is not set")
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: {
  sub: string
  email: string
  role: string
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
    return payload as unknown as JwtPayload
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
