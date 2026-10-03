import { NextResponse } from 'next/server'
import {
  LOGIN_FAIL_THRESHOLD,
  captchaResponseFields,
  getLoginFailCount,
} from '@/lib/auth/login-captcha'

/** Indica se o captcha é necessário e devolve o provedor (reCAPTCHA ou math). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const username = (searchParams.get('username') || '').toLowerCase().trim()
    if (!username) {
      return NextResponse.json({ requiresCaptcha: false })
    }

    const fails = await getLoginFailCount(username)
    if (fails < LOGIN_FAIL_THRESHOLD) {
      return NextResponse.json({
        requiresCaptcha: false,
        failedAttempts: fails,
      })
    }

    return NextResponse.json({
      ...(await captchaResponseFields()),
      failedAttempts: fails,
    })
  } catch (error) {
    console.error('Captcha error:', error)
    return NextResponse.json({ error: 'Erro ao gerar captcha' }, { status: 500 })
  }
}
