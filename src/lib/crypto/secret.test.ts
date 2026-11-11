import { afterEach, describe, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.resetModules()
  vi.unstubAllEnvs()
})

describe('crypto/secret', () => {
  it('criptografa e descriptografa com JWT_SECRET', async () => {
    vi.stubEnv('JWT_SECRET', 'test-secret-for-unit-tests')
    const { encryptSecret, decryptSecret, maskSecret } = await import('./secret')
    const cipher = encryptSecret('chave-gemini-123')
    expect(cipher.startsWith('v1.')).toBe(true)
    expect(decryptSecret(cipher)).toBe('chave-gemini-123')
    expect(maskSecret('abcd')).toBe('••••')
    expect(maskSecret('  super-secret  ')).toBe('••••cret')
  })

  it('usa SETTINGS_ENCRYPTION_KEY quando definido', async () => {
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', 'settings-key-abc')
    vi.stubEnv('JWT_SECRET', '')
    const { encryptSecret, decryptSecret } = await import('./secret')
    expect(decryptSecret(encryptSecret('x'))).toBe('x')
  })

  it('falha sem chave e com payload inválido', async () => {
    vi.stubEnv('JWT_SECRET', '')
    vi.stubEnv('SETTINGS_ENCRYPTION_KEY', '')
    const { encryptSecret, decryptSecret } = await import('./secret')
    expect(() => encryptSecret('a')).toThrow(/JWT_SECRET/)
    vi.stubEnv('JWT_SECRET', 'ok')
    vi.resetModules()
    const mod = await import('./secret')
    expect(() => mod.decryptSecret('bad')).toThrow(/inválido/)
    expect(() => mod.decryptSecret('v2.a.b.c')).toThrow(/inválido/)
  })
})
