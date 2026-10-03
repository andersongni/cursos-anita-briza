import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import {
  clearSessionCookie,
  createToken,
  getSession,
  setSessionCookie,
} from '@/lib/auth/session'

export async function GET() {
  try {
    const session = await getSession()

    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

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
        session_version: true,
        must_change_password: true,
        last_login_at: true,
        created_at: true,
      },
    })

    if (!profile) {
      await clearSessionCookie()
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const tokenVersion = session.sessionVersion ?? 0
    if (tokenVersion !== profile.session_version) {
      await clearSessionCookie()
      return NextResponse.json(
        { error: 'Sessão invalidada. Faça login novamente.' },
        { status: 401 }
      )
    }

    const mustChangePassword = Boolean(profile.must_change_password)
    const sessionNeedsSync =
      session.status !== profile.status ||
      session.role !== profile.role ||
      Boolean(session.mustChangePassword) !== mustChangePassword

    // Sincroniza JWT (aprovação, bloqueio ou troca obrigatória de senha)
    if (sessionNeedsSync) {
      if (profile.status === 'BLOCKED') {
        await clearSessionCookie()
        return NextResponse.json({ error: 'Conta bloqueada' }, { status: 403 })
      }

      const token = await createToken({
        userId: profile.id,
        username: profile.username,
        role: profile.role,
        status: profile.status,
        sessionVersion: profile.session_version ?? 0,
        mustChangePassword,
      })
      await setSessionCookie(token)
    }

    return NextResponse.json({
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
    })
  } catch (error) {
    console.error('Me error:', error)
    return NextResponse.json(
      { error: 'Ocorreu um erro ao buscar os dados do usuário' },
      { status: 500 }
    )
  }
}
