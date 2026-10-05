import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import bcrypt from 'bcryptjs'
import { createToken, setSessionCookie } from '@/lib/auth/session'
import {
  formatFullName,
  formatPhoneMask,
  isValidBrazilianMobile,
  isValidEmail,
  isValidFullName,
  isValidUsername,
  phoneDigits,
} from '@/lib/utils'
import {
  captchaResponseFields,
  verifyCaptchaFromBody,
} from '@/lib/auth/login-captcha'

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const {
      username,
      password,
      full_name,
      email,
      phone,
      courseIds,
      captchaToken,
      captchaAnswer,
      recaptchaToken,
    } = body

    const captchaOk = await verifyCaptchaFromBody({
      recaptchaToken,
      captchaToken,
      captchaAnswer,
    })
    if (!captchaOk) {
      return NextResponse.json(
        {
          error: 'Complete o captcha para continuar.',
          ...(await captchaResponseFields()),
        },
        { status: 400 }
      )
    }

    const normalizedFullName = typeof full_name === 'string' ? formatFullName(full_name) : ''

    if (!username || !password || !normalizedFullName) {
      return NextResponse.json(
        { error: 'Nome de usuário, senha e nome completo são obrigatórios' },
        { status: 400 }
      )
    }

    if (!isValidFullName(normalizedFullName)) {
      return NextResponse.json(
        {
          error: 'Informe nome e sobrenome (pelo menos duas palavras)',
          ...(await captchaResponseFields()),
        },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter pelo menos 6 caracteres' },
        { status: 400 }
      )
    }

    const normalizedUsername = typeof username === 'string' ? username.trim().toLowerCase() : ''

    if (!isValidUsername(normalizedUsername)) {
      return NextResponse.json(
        { error: 'O nome de usuário deve conter apenas letras minúsculas, números e pontos' },
        { status: 400 }
      )
    }

    const normalizedEmail =
      typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null
    if (normalizedEmail && !isValidEmail(normalizedEmail)) {
      return NextResponse.json(
        {
          error: 'Informe um e-mail válido (ex.: maria.silva@email.com)',
          ...(await captchaResponseFields()),
        },
        { status: 400 }
      )
    }

    const rawPhone = typeof phone === 'string' ? phone.trim() : ''
    let normalizedPhone: string | null = null
    if (rawPhone) {
      if (!isValidBrazilianMobile(rawPhone)) {
        return NextResponse.json(
          {
            error: 'Informe um telefone válido no formato (XX) XXXXX-XXXX',
            ...(await captchaResponseFields()),
          },
          { status: 400 }
        )
      }
      normalizedPhone = formatPhoneMask(phoneDigits(rawPhone))
    }

    const existingUser = await prisma.profile.findUnique({
      where: { username: normalizedUsername },
    })

    if (existingUser) {
      return NextResponse.json(
        {
          error: 'Nome de usuário já está em uso',
          ...(await captchaResponseFields()),
        },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const requestedCourseIds = Array.isArray(courseIds)
      ? [...new Set(courseIds.filter((id: unknown) => typeof id === 'string' && id.trim()))]
      : []

    if (requestedCourseIds.length === 0) {
      return NextResponse.json(
        {
          error: 'Selecione ao menos um curso para solicitar matrícula',
          ...(await captchaResponseFields()),
        },
        { status: 400 }
      )
    }

    const { ensureCourses, listActiveCourses } = await import('@/lib/courses')
    await ensureCourses()
    const activeCourses = await listActiveCourses()
    const activeIds = new Set(activeCourses.map((c) => c.id))
    const validCourseIds = requestedCourseIds.filter((id) => activeIds.has(id))
    if (validCourseIds.length === 0) {
      return NextResponse.json(
        {
          error: 'Nenhum curso válido selecionado',
          ...(await captchaResponseFields()),
        },
        { status: 400 }
      )
    }

    const profile = await prisma.profile.create({
      data: {
        username: normalizedUsername,
        full_name: normalizedFullName,
        email: normalizedEmail,
        phone: normalizedPhone,
        role: 'STUDENT',
        status: 'PENDING',
        password_hash: hashedPassword,
      },
    })

    // Solicitações de matrícula — ficam PENDING até o admin aprovar
    await prisma.courseEnrollment.createMany({
      data: validCourseIds.map((course_id) => ({
        student_id: profile.id,
        course_id,
        status: 'PENDING',
      })),
    })

    // Sessão PENDING para acessar /aguardando-aprovacao
    const token = await createToken({
      userId: profile.id,
      username: profile.username,
      role: profile.role,
      status: profile.status,
      sessionVersion: profile.session_version ?? 0,
      mustChangePassword: false,
    })
    await setSessionCookie(token)

    return NextResponse.json({ success: true, status: profile.status })
  } catch (error) {
    console.error('Registration error:', error)
    return NextResponse.json(
      { error: 'Ocorreu um erro ao registrar o usuário' },
      { status: 500 }
    )
  }
}
