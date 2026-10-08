import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
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

type LoginBody = {
  username: string
  password: string
  captchaToken?: string
  captchaAnswer?: string
  recaptchaToken?: string
}

function parseLoginBody(raw: unknown): LoginBody | null {
  if (!raw || typeof raw !== 'object') return null
  const body = raw as Record<string, unknown>
  const username =
    typeof body.username === 'string' ? body.username.toLowerCase().trim() : ''
  const password = typeof body.password === 'string' ? body.password : ''
  if (!username || !password) return null

  return {
    username,
    password,
    captchaToken:
      typeof body.captchaToken === 'string' ? body.captchaToken : undefined,
    captchaAnswer:
      typeof body.captchaAnswer === 'string' ? body.captchaAnswer : undefined,
    recaptchaToken:
      typeof body.recaptchaToken === 'string' ? body.recaptchaToken : undefined,
  }
}

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
    const credentials = parseLoginBody(await req.json())
    if (!credentials) {
      return NextResponse.json(
        { error: 'Usuário e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const { username, password, captchaToken, captchaAnswer, recaptchaToken } =
      credentials

    const failCount = await getLoginFailCount(username)

    // Captcha após N falhas por usuário — esperado, não é bypass de autenticação.
    // codeql[js/user-controlled-bypass]
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
      where: { username },
    })

    if (!profile) {
      return failedLoginResponse(username)
    }

    const isPasswordValid = await bcrypt.compare(password, profile.password_hash)

    if (!isPasswordValid) {
      return failedLoginResponse(username)
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
  } catch {
    console.error('Login error')
    return NextResponse.json(
      { error: 'Ocorreu um erro ao fazer login' },
      { status: 500 }
    )
  }
}
