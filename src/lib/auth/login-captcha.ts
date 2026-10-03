import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { getRecaptchaSiteKey, isRecaptchaConfigured } from '@/lib/auth/recaptcha'

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'dev-secret-anita-briza-change-in-production'
)

export const LOGIN_FAIL_THRESHOLD = 3
const FAIL_COOKIE = 'login_fails'
const FAIL_MAX_AGE_SEC = 60 * 30 // 30 min
const MATH_CAPTCHA_MAX_AGE_SEC = 60 * 10 // 10 min

type FailPayload = { u: string; c: number }
type MathCaptchaPayload = { a: number }

export type CaptchaChallenge = {
  question: string
  token: string
}

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge,
    path: '/',
  }
}

export async function getLoginFailCount(username: string): Promise<number> {
  const key = username.toLowerCase().trim()
  if (!key) return 0

  const store = await cookies()
  const raw = store.get(FAIL_COOKIE)?.value
  if (!raw) return 0

  try {
    const { payload } = await jwtVerify(raw, SECRET)
    const data = payload as unknown as FailPayload
    if (data.u !== key) return 0
    const count = Number(data.c)
    return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0
  } catch {
    return 0
  }
}

export async function setLoginFailCount(username: string, count: number): Promise<void> {
  const key = username.toLowerCase().trim()
  const store = await cookies()

  if (count <= 0) {
    store.delete(FAIL_COOKIE)
    return
  }

  const token = await new SignJWT({ u: key, c: count } satisfies FailPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${FAIL_MAX_AGE_SEC}s`)
    .sign(SECRET)

  store.set(FAIL_COOKIE, token, cookieOptions(FAIL_MAX_AGE_SEC))
}

export async function clearLoginFailCount(): Promise<void> {
  const store = await cookies()
  store.delete(FAIL_COOKIE)
}

export async function incrementLoginFailCount(username: string): Promise<number> {
  const current = await getLoginFailCount(username)
  const next = current + 1
  await setLoginFailCount(username, next)
  return next
}

/** Fallback local quando o reCAPTCHA não está configurado. */
export async function createMathCaptchaChallenge(): Promise<CaptchaChallenge> {
  const left = 1 + Math.floor(Math.random() * 9)
  const right = 1 + Math.floor(Math.random() * 9)
  const answer = left + right

  const token = await new SignJWT({ a: answer } satisfies MathCaptchaPayload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MATH_CAPTCHA_MAX_AGE_SEC}s`)
    .sign(SECRET)

  return {
    question: `${left} + ${right}`,
    token,
  }
}

export async function verifyMathCaptchaAnswer(
  token: string | undefined,
  answer: unknown
): Promise<boolean> {
  if (!token || typeof token !== 'string') return false

  const parsed =
    typeof answer === 'number'
      ? answer
      : typeof answer === 'string'
        ? Number(answer.trim())
        : NaN

  if (!Number.isFinite(parsed)) return false

  try {
    const { payload } = await jwtVerify(token, SECRET)
    const expected = Number((payload as unknown as MathCaptchaPayload).a)
    return Number.isFinite(expected) && Math.floor(parsed) === expected
  } catch {
    return false
  }
}

export async function captchaResponseFields() {
  if (isRecaptchaConfigured()) {
    return {
      requiresCaptcha: true as const,
      captchaProvider: 'recaptcha' as const,
      recaptchaSiteKey: getRecaptchaSiteKey(),
    }
  }

  const challenge = await createMathCaptchaChallenge()
  return {
    requiresCaptcha: true as const,
    captchaProvider: 'math' as const,
    captchaQuestion: challenge.question,
    captchaToken: challenge.token,
  }
}
