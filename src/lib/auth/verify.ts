import { clearSessionCookie, getSession, isSessionIdle } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

async function loadProfile(userId: string) {
  return prisma.profile.findUnique({
    where: { id: userId },
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
      last_login_at: true,
      created_at: true,
      updated_at: true,
    },
  })
}

// ── Verify any authenticated user ─────────────────────────────────────────────
export async function verifyAuth() {
  const session = await getSession()
  if (!session) {
    throw Object.assign(new Error('Não autenticado'), { status: 401 })
  }

  if (isSessionIdle(session)) {
    await clearSessionCookie()
    throw Object.assign(new Error('Sessão expirada por inatividade. Faça login novamente.'), {
      status: 401,
    })
  }

  const profile = await loadProfile(session.userId)

  if (!profile) {
    await clearSessionCookie()
    throw Object.assign(new Error('Perfil não encontrado'), { status: 401 })
  }

  const tokenVersion = session.sessionVersion ?? 0
  if (tokenVersion !== profile.session_version) {
    await clearSessionCookie()
    throw Object.assign(new Error('Sessão expirada. Faça login novamente.'), { status: 401 })
  }

  if (profile.deleted_at) {
    await clearSessionCookie()
    throw Object.assign(new Error('Conta excluída'), { status: 403 })
  }

  if (profile.status === 'BLOCKED') {
    await clearSessionCookie()
    throw Object.assign(new Error('Conta bloqueada'), { status: 403 })
  }

  return { user: { id: profile.id }, profile, session }
}

// ── Verify admin ───────────────────────────────────────────────────────────────
export async function verifyAdmin() {
  const { user, profile, session } = await verifyAuth()

  if (profile.role !== 'ADMIN') {
    throw Object.assign(new Error('Acesso restrito a administradores'), { status: 403 })
  }

  return { user, profile, session }
}

/** Invalida todas as sessões JWT do usuário (ex.: após reset de senha). */
export async function invalidateUserSessions(userId: string) {
  await prisma.profile.update({
    where: { id: userId },
    data: { session_version: { increment: 1 } },
  })
}

// ── Helper: wrap route handler with auth error handling ────────────────────────
export function withAuth(
  handler: (req: Request, ctx: any) => Promise<NextResponse>
) {
  return async (req: Request, ctx: any) => {
    try {
      return await handler(req, ctx)
    } catch (error: any) {
      const status = error.status ?? 500
      return NextResponse.json({ error: error.message }, { status })
    }
  }
}
