import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db'
import { NextResponse } from 'next/server'

// ── Verify any authenticated user ─────────────────────────────────────────────
export async function verifyAuth() {
  const session = await getSession()
  if (!session) {
    throw Object.assign(new Error('Não autenticado'), { status: 401 })
  }

  // Refresh profile from DB (status may have changed)
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
      last_login_at: true,
      created_at: true,
      updated_at: true,
    },
  })

  if (!profile) {
    throw Object.assign(new Error('Perfil não encontrado'), { status: 401 })
  }

  if (profile.status === 'BLOCKED') {
    throw Object.assign(new Error('Conta bloqueada'), { status: 403 })
  }

  return { user: { id: profile.id }, profile }
}

// ── Verify admin ───────────────────────────────────────────────────────────────
export async function verifyAdmin() {
  const { user, profile } = await verifyAuth()

  if (profile.role !== 'ADMIN') {
    throw Object.assign(new Error('Acesso restrito a administradores'), { status: 403 })
  }

  return { user, profile }
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
