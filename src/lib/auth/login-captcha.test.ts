import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore = vi.hoisted(() => ({
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => cookieStore),
}))

vi.mock('@/lib/auth/recaptcha', () => ({
  isRecaptchaConfigured: vi.fn(() => false),
  getRecaptchaSiteKey: vi.fn(() => 'site-key'),
  verifyRecaptchaToken: vi.fn(async () => true),
}))

import {
  captchaResponseFields,
  clearLoginFailCount,
  createMathCaptchaChallenge,
  getLoginFailCount,
  incrementLoginFailCount,
  setLoginFailCount,
  verifyCaptchaFromBody,
  verifyMathCaptchaAnswer,
} from './login-captcha'
import { isRecaptchaConfigured, verifyRecaptchaToken } from '@/lib/auth/recaptcha'

describe('login-captcha', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(isRecaptchaConfigured).mockReturnValue(false)
    cookieStore.get.mockReturnValue(undefined)
  })

  it('conta falhas por username', async () => {
    expect(await getLoginFailCount('')).toBe(0)
    expect(await getLoginFailCount('ana')).toBe(0)

    await setLoginFailCount('Ana', 2)
    expect(cookieStore.set).toHaveBeenCalled()
    const token = cookieStore.set.mock.calls[0][1] as string
    cookieStore.get.mockReturnValue({ value: token })
    expect(await getLoginFailCount('ana')).toBe(2)
    expect(await getLoginFailCount('other')).toBe(0)

    const { SignJWT } = await import('jose')
    const secret = new TextEncoder().encode(
      process.env.JWT_SECRET ?? 'dev-secret-anita-briza-change-in-production'
    )
    const zero = await new SignJWT({ u: 'ana', c: 0 })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret)
    cookieStore.get.mockReturnValue({ value: zero })
    expect(await getLoginFailCount('ana')).toBe(0)


    await setLoginFailCount('ana', 0)
    expect(cookieStore.delete).toHaveBeenCalled()

    cookieStore.get.mockReturnValue({ value: 'broken' })
    expect(await getLoginFailCount('ana')).toBe(0)

    await clearLoginFailCount()
    const next = await incrementLoginFailCount('bob')
    expect(next).toBe(1)
  })

  it('desafio matemático', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0)
    const challenge = await createMathCaptchaChallenge()
    expect(challenge.question).toBe('1 + 1')
    expect(await verifyMathCaptchaAnswer(challenge.token, 2)).toBe(true)
    expect(await verifyMathCaptchaAnswer(challenge.token, '2')).toBe(true)
    expect(await verifyMathCaptchaAnswer(undefined, 2)).toBe(false)
    expect(await verifyMathCaptchaAnswer(challenge.token, 'x')).toBe(false)
    expect(await verifyMathCaptchaAnswer('bad', 2)).toBe(false)
    expect(await verifyMathCaptchaAnswer(challenge.token, true)).toBe(false)
  })

  it('captchaResponseFields e verifyCaptchaFromBody', async () => {
    const math = await captchaResponseFields()
    expect(math.captchaProvider).toBe('math')

    vi.mocked(isRecaptchaConfigured).mockReturnValue(true)
    const rec = await captchaResponseFields()
    expect(rec.captchaProvider).toBe('recaptcha')

    expect(await verifyCaptchaFromBody({ recaptchaToken: 't' })).toBe(true)
    expect(verifyRecaptchaToken).toHaveBeenCalled()

    vi.mocked(isRecaptchaConfigured).mockReturnValue(false)
    const challenge = await createMathCaptchaChallenge()
    expect(
      await verifyCaptchaFromBody({
        captchaToken: challenge.token,
        captchaAnswer: Number(challenge.question.split(' + ').reduce((a, b) => String(Number(a) + Number(b)))),
      })
    ).toBe(true)
    expect(await verifyCaptchaFromBody({ captchaToken: 123, captchaAnswer: 1 })).toBe(
      false
    )
  })
})

