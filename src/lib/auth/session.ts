import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-anita-briza-change-in-production'
)

export const COOKIE_NAME = 'auth-token'
/** Teto absoluto da sessão (mesmo com uso contínuo). */
const EXPIRES_IN = '7d'
/** Logout após este período sem atividade do usuário. */
export const IDLE_TIMEOUT_SECONDS = 60 * 60 * 24
/** Evita reescrever o cookie/JWT a cada request. */
export const ACTIVITY_REFRESH_THROTTLE_SECONDS = 5 * 60

export interface SessionPayload {
  userId: string
  username: string
  role: string
  status: string
  /** Incrementado ao resetar/alterar senha — invalida JWTs antigos */
  sessionVersion: number
  /** Admin (ou usuário) deve trocar a senha antes de usar o sistema */
  mustChangePassword?: boolean
  /** Unix seconds — última atividade do usuário (não inclui polling silencioso) */
  lastActivityAt?: number
  /** Presente no JWT padrão do jose */
  iat?: number
}

function nowSeconds(): number {
  return Math.floor(Date.now() / 1000)
}

export function getLastActivityAt(session: SessionPayload): number | null {
  if (typeof session.lastActivityAt === 'number' && Number.isFinite(session.lastActivityAt)) {
    return session.lastActivityAt
  }
  if (typeof session.iat === 'number' && Number.isFinite(session.iat)) {
    return session.iat
  }
  return null
}

export function isSessionIdle(session: SessionPayload): boolean {
  const last = getLastActivityAt(session)
  if (last == null) return true
  return nowSeconds() - last > IDLE_TIMEOUT_SECONDS
}

export function shouldRefreshActivity(session: SessionPayload): boolean {
  const last = getLastActivityAt(session)
  if (last == null) return true
  return nowSeconds() - last >= ACTIVITY_REFRESH_THROTTLE_SECONDS
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    // Alinha com o idle: sem Set-Cookie por 24h o browser descarta a sessão
    maxAge: IDLE_TIMEOUT_SECONDS,
    path: '/',
  }
}

// ── Create ──────────────────────────────────────────────────────────────────
export async function createToken(payload: SessionPayload): Promise<string> {
  const lastActivityAt = payload.lastActivityAt ?? nowSeconds()
  const { iat: _iat, ...rest } = payload
  void _iat

  return new SignJWT({ ...rest, lastActivityAt } as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(EXPIRES_IN)
    .sign(SECRET)
}

/** Reemite o JWT com lastActivityAt atualizado (throttle no chamador). */
export async function refreshSessionActivity(session: SessionPayload): Promise<string> {
  return createToken({
    userId: session.userId,
    username: session.username,
    role: session.role,
    status: session.status,
    sessionVersion: session.sessionVersion,
    mustChangePassword: session.mustChangePassword,
    lastActivityAt: nowSeconds(),
  })
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
  store.set(COOKIE_NAME, token, sessionCookieOptions())
}

export function setSessionCookieOnResponse(response: NextResponse, token: string): void {
  response.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
}

export function clearSessionCookieOnResponse(response: NextResponse): void {
  response.cookies.delete(COOKIE_NAME)
}

// ── Clear session cookie ───────────────────────────────────────────────────────
export async function clearSessionCookie(): Promise<void> {
  const store = await cookies()
  store.delete(COOKIE_NAME)
}
