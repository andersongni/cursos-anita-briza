import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  getRecaptchaSiteKey,
  isRecaptchaConfigured,
  verifyRecaptchaToken,
} from './recaptcha'

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('recaptcha', () => {
  it('detecta configuração e site key', () => {
    vi.stubEnv('RECAPTCHA_SECRET_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_SITE_KEY', '')
    expect(isRecaptchaConfigured()).toBe(false)
    expect(getRecaptchaSiteKey()).toBeUndefined()

    vi.stubEnv('RECAPTCHA_SECRET_KEY', 'sec')
    vi.stubEnv('NEXT_PUBLIC_RECAPTCHA_SITE_KEY', 'site')
    expect(isRecaptchaConfigured()).toBe(true)
    expect(getRecaptchaSiteKey()).toBe('site')
  })

  it('verifyRecaptchaToken cobre falhas e sucesso', async () => {
    vi.stubEnv('RECAPTCHA_SECRET_KEY', '')
    expect(await verifyRecaptchaToken('t')).toBe(false)

    vi.stubEnv('RECAPTCHA_SECRET_KEY', 'sec')
    expect(await verifyRecaptchaToken('')).toBe(false)
    expect(await verifyRecaptchaToken(1)).toBe(false)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ ok: false, json: async () => ({}) }))
    )
    expect(await verifyRecaptchaToken('tok')).toBe(false)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ success: true }),
      }))
    )
    expect(await verifyRecaptchaToken('tok')).toBe(true)

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network')
      })
    )
    expect(await verifyRecaptchaToken('tok')).toBe(false)
  })
})
