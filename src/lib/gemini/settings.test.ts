import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  systemSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
    deleteMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma }))

vi.mock('@/lib/crypto/secret', () => ({
  encryptSecret: vi.fn((s: string) => `enc:${s}`),
  decryptSecret: vi.fn((s: string) => {
    if (s === 'bad') throw new Error('fail')
    return s.replace(/^enc:/, '')
  }),
  maskSecret: vi.fn((s: string) => `••••${s.slice(-4)}`),
}))

import {
  clearGeminiApiKey,
  DEFAULT_GEMINI_MODEL,
  GEMINI_API_KEY_SETTING,
  getGeminiApiKey,
  getGeminiModel,
  getGeminiSettingsStatus,
  setGeminiApiKey,
} from './settings'

describe('gemini settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('lê chave do banco / env e status', async () => {
    prisma.systemSetting.findUnique.mockResolvedValueOnce({ value: 'enc:db-key-12345678901234567890' })
    expect(await getGeminiApiKey()).toBe('db-key-12345678901234567890')

    prisma.systemSetting.findUnique.mockResolvedValueOnce({ value: 'bad' })
    vi.stubEnv('GEMINI_API_KEY', 'env-key')
    expect(await getGeminiApiKey()).toBe('env-key')

    const { decryptSecret } = await import('@/lib/crypto/secret')
    vi.mocked(decryptSecret).mockReturnValueOnce('   ')
    prisma.systemSetting.findUnique.mockResolvedValueOnce({ value: 'enc:spaces' })
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '')
    expect(await getGeminiApiKey()).toBeNull()

    prisma.systemSetting.findUnique.mockResolvedValueOnce(null)
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', 'google-key')
    expect(await getGeminiApiKey()).toBe('google-key')

    prisma.systemSetting.findUnique.mockResolvedValueOnce({ value: '   ' })
    expect(await getGeminiApiKey()).toBe('google-key')


    expect(await getGeminiModel()).toBe(DEFAULT_GEMINI_MODEL)
    vi.stubEnv('GEMINI_MODEL', 'custom-model')
    expect(await getGeminiModel()).toBe('custom-model')
  })

  it('status configured database/env/none', async () => {
    prisma.systemSetting.findUnique.mockResolvedValueOnce({
      value: 'enc:abcdefghijklmnopqrst',
    })
    const db = await getGeminiSettingsStatus()
    expect(db.source).toBe('database')
    expect(db.configured).toBe(true)

    prisma.systemSetting.findUnique.mockResolvedValueOnce(null)
    vi.stubEnv('GEMINI_API_KEY', 'abcdefghijklmnopqrstuv')
    const env = await getGeminiSettingsStatus()
    expect(env.source).toBe('env')

    prisma.systemSetting.findUnique.mockResolvedValueOnce(null)
    vi.stubEnv('GEMINI_API_KEY', '')
    vi.stubEnv('GOOGLE_GENERATIVE_AI_API_KEY', '')
    const none = await getGeminiSettingsStatus()
    expect(none.configured).toBe(false)
    expect(none.maskedKey).toBeNull()
  })

  it('set/clear api key', async () => {
    await expect(setGeminiApiKey('  ', 'u1')).rejects.toMatchObject({ status: 400 })
    await expect(setGeminiApiKey('short', 'u1')).rejects.toMatchObject({ status: 400 })
    await setGeminiApiKey('abcdefghijklmnopqrstuvwxyz', 'u1')
    expect(prisma.systemSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: GEMINI_API_KEY_SETTING } })
    )
    await clearGeminiApiKey('u1')
    expect(prisma.systemSetting.deleteMany).toHaveBeenCalled()
  })
})
