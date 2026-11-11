import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  COOKIE_NAME,
  createToken,
  getSession,
  isSessionIdle,
  refreshSessionActivity,
  sessionCookieOptions,
  shouldRefreshActivity,
} from '@/lib/auth/session'

function jsonWithClearedSession(
  body: Record<string, unknown>,
  status: number
) {
  const res = NextResponse.json(body, { status })
  res.cookies.set(COOKIE_NAME, '', {
    ...sessionCookieOptions(),
    maxAge: 0,
  })
  return res
}

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    if (isSessionIdle(session)) {
      return jsonWithClearedSession(
        {
          error: 'Sessão expirada por inatividade. Faça login novamente.',
          code: 'IDLE',
        },
        401
      )
    }

    const touch = request.nextUrl.searchParams.get('touch') === '1'

    const profile = await prisma.profile.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        deleted_at: true,
        session_version: true,
        must_change_password: true,
        last_login_at: true,
        created_at: true,
      },
    })

    if (!profile) {
      return jsonWithClearedSession({ error: 'Não autenticado' }, 401)
    }

    const tokenVersion = session.sessionVersion ?? 0
    if (tokenVersion !== profile.session_version) {
      return jsonWithClearedSession(
        { error: 'Sessão invalidada. Faça login novamente.', code: 'SESSION_REVOKED' },
        401
      )
    }

    if (profile.deleted_at) {
      return jsonWithClearedSession(
        { error: 'Conta excluída', code: 'DELETED' },
        401
      )
    }

    const mustChangePassword = Boolean(profile.must_change_password)
    const sessionNeedsSync =
      session.status !== profile.status ||
      session.role !== profile.role ||
      Boolean(session.mustChangePassword) !== mustChangePassword

    const body = {
      id: profile.id,
      username: profile.username,
      full_name: profile.full_name,
      email: profile.email,
      phone: profile.phone,
      role: profile.role,
      status: profile.status,
      must_change_password: profile.must_change_password,
      last_login_at: profile.last_login_at,
      created_at: profile.created_at,
    }

    // Sincroniza JWT (aprovação, bloqueio ou troca obrigatória de senha)
    // Cookie precisa ir no NextResponse — cookies().set() pode não chegar no browser.
    if (sessionNeedsSync) {
      if (profile.status === 'BLOCKED') {
        return jsonWithClearedSession({ error: 'Conta bloqueada' }, 403)
      }

      const token = await createToken({
        userId: profile.id,
        username: profile.username,
        role: profile.role,
        status: profile.status,
        sessionVersion: profile.session_version ?? 0,
        mustChangePassword,
        lastActivityAt: session.lastActivityAt,
      })
      const res = NextResponse.json(body)
      res.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
      return res
    }

    if (touch && shouldRefreshActivity(session)) {
      const token = await refreshSessionActivity({
        ...session,
        role: profile.role,
        status: profile.status,
        sessionVersion: profile.session_version ?? 0,
        mustChangePassword,
      })
      const res = NextResponse.json(body)
      res.cookies.set(COOKIE_NAME, token, sessionCookieOptions())
      return res
    }

    return NextResponse.json(body)
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json(
      { error: 'Ocorreu um erro ao buscar os dados do usuário' },
      { status: 500 }
    )
  }
}
