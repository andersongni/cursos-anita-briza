import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-anita-briza-change-in-production'
)

const COOKIE_NAME = 'auth-token'
const EXPIRES_IN = '7d'

export interface SessionPayload {
  userId: string
  username: string
  role: string
  status: string
  /** Incrementado ao resetar/alterar senha — invalida JWTs antigos */
  sessionVersion: number
  /** Admin (ou usuário) deve trocar a senha antes de usar o sistema */
  mustChangePassword?: boolean
}

// ── Create ──────────────────────────────────────────────────────────────────
export async function createToken(payload: SessionPayload): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET)
}

// ── Verify ───────────────────────────────────────────────────────────────────
export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET)
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

// ── Get session from cookies (Server Components / Route Handlers) ─────────────
export async function getSession(): Promise<SessionPayload | null> {
  const store = await cookies()
  const token = store.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// ── Get session from request (Middleware) ─────────────────────────────────────
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(COOKIE_NAME)?.value
  if (!token) return null
  return verifyToken(token)
}

// ── Set session cookie ─────────────────────────────────────────────────────────
export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies()
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: '/',
  })
}

// ── Clear session cookie ───────────────────────────────────────────────────────
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
