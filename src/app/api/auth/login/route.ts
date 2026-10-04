import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { getDatabaseUrl } from '@/lib/db-url'
import bcrypt from 'bcryptjs'
import { createToken, setSessionCookie } from '@/lib/auth/session'
import {
  LOGIN_FAIL_THRESHOLD,
  captchaResponseFields,
  clearLoginFailCount,
  getLoginFailCount,
  incrementLoginFailCount,
  verifyCaptchaFromBody,
} from '@/lib/auth/login-captcha'

async function failedLoginResponse(username: string, message = 'Usuário ou senha incorretos') {
  const failedAttempts = await incrementLoginFailCount(username)
  const body: Record<string, unknown> = {
    error: message,
    failedAttempts,
    requiresCaptcha: failedAttempts >= LOGIN_FAIL_THRESHOLD,
  }

  if (failedAttempts >= LOGIN_FAIL_THRESHOLD) {
    Object.assign(body, await captchaResponseFields())
  }

  return NextResponse.json(body, { status: 401 })
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { username, password, captchaToken, captchaAnswer, recaptchaToken } = body

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const normalizedUsername = String(username).toLowerCase().trim()
    const failCount = await getLoginFailCount(normalizedUsername)

    if (failCount >= LOGIN_FAIL_THRESHOLD) {
      const captchaOk = await verifyCaptchaFromBody({
        recaptchaToken,
        captchaToken,
        captchaAnswer,
      })
      if (!captchaOk) {
        return NextResponse.json(
          {
            error: 'Complete o captcha para continuar.',
            failedAttempts: failCount,
            ...(await captchaResponseFields()),
          },
          { status: 400 }
        )
      }
    }

    const profile = await prisma.profile.findUnique({
      where: { username: normalizedUsername },
    })

    if (!profile) {
      if (process.env.NODE_ENV === 'development') {
        console.info(`[login] user=${normalizedUsername} → not found`)
      }
      return failedLoginResponse(normalizedUsername)
    }

    const isPasswordValid = await bcrypt.compare(password, profile.password_hash)

    if (!isPasswordValid) {
      if (process.env.NODE_ENV === 'development') {
        const db = getDatabaseUrl()
        console.info(
          `[login] user=${normalizedUsername} → password mismatch | db=${db.startsWith('file:') ? 'sqlite' : 'turso'}`
        )
      }
      return failedLoginResponse(normalizedUsername)
    }

    if (process.env.NODE_ENV === 'development') {
      console.info(`[login] user=${normalizedUsername} → ok`)
    }

    if (profile.deleted_at) {
      return NextResponse.json(
        { error: 'Conta excluída. Entre em contato com o administrador.' },
        { status: 403 }
      )
    }

    if (profile.status === 'BLOCKED') {
      return NextResponse.json(
        { error: 'Conta bloqueada. Entre em contato com o administrador.' },
        { status: 403 }
      )
    }

    await clearLoginFailCount()

    await prisma.profile.update({
      where: { id: profile.id },
      data: { last_login_at: new Date() },
    })

    const mustChangePassword = Boolean(profile.must_change_password)

    const token = await createToken({
      userId: profile.id,
      username: profile.username,
      role: profile.role,
      status: profile.status,
      sessionVersion: profile.session_version ?? 0,
      mustChangePassword,
    })

    await setSessionCookie(token)

    return NextResponse.json({
      success: true,
      role: profile.role,
      status: profile.status,
      username: profile.username,
      full_name: profile.full_name,
      must_change_password: mustChangePassword,
    })
  } catch (error) {
    console.error('Login error:', error)
    return NextResponse.json(
      { error: 'Ocorreu um erro ao fazer login' },
      { status: 500 }
    )
  }
}
