import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  systemSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma }))

import {
  DEFAULT_MS_PER_DISCURSIVE,
  estimateDiscursiveGrading,
  formatGradingEta,
  getDiscursiveGradingAvgMs,
  recordDiscursiveGradingSample,
} from './grading-latency'

describe('formatGradingEta', () => {
  it('formata segundos e minutos', () => {
    expect(formatGradingEta(1)).toBe('cerca de 1 segundo')
    expect(formatGradingEta(30)).toBe('cerca de 30 segundos')
    expect(formatGradingEta(60)).toBe('cerca de 1 minuto')
    expect(formatGradingEta(125)).toBe('cerca de 2 minutos')
  })
})

describe('recordDiscursiveGradingSample', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('ignora amostras inválidas', async () => {
    await recordDiscursiveGradingSample(100, 1)
    await recordDiscursiveGradingSample(1000, 0)
    await recordDiscursiveGradingSample(NaN, 2)
    expect(prisma.systemSetting.findUnique).not.toHaveBeenCalled()
  })

  it('persiste amostra válida e ignora perQuestion baixo', async () => {
    prisma.systemSetting.findUnique.mockResolvedValueOnce({ value: '[1000, "x"]' })
    await recordDiscursiveGradingSample(2000, 2)
    expect(prisma.systemSetting.upsert).toHaveBeenCalled()

    prisma.systemSetting.findUnique.mockResolvedValueOnce({ value: 'not-json' })
    await recordDiscursiveGradingSample(900, 2) // perQuestion 450 < 500
    expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(1)
  })

  it('trata JSON inválido / não-array', async () => {
    prisma.systemSetting.findUnique.mockResolvedValueOnce({ value: '{"a":1}' })
    await recordDiscursiveGradingSample(4000, 1)
    expect(prisma.systemSetting.upsert).toHaveBeenCalled()
  })
})

describe('getDiscursiveGradingAvgMs / estimate', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('usa default sem amostras', async () => {
    prisma.systemSetting.findUnique.mockResolvedValueOnce(null)
    const avg = await getDiscursiveGradingAvgMs()
    expect(avg.avgMsPerQuestion).toBe(DEFAULT_MS_PER_DISCURSIVE)
    expect(avg.sampleCount).toBe(0)
  })

  it('ignora JSON inválido nas amostras', async () => {
    prisma.systemSetting.findUnique.mockResolvedValueOnce({ value: 'not-json{' })
    const avg = await getDiscursiveGradingAvgMs()
    expect(avg.sampleCount).toBe(0)
  })


  it('estima com amostras', async () => {
    prisma.systemSetting.findUnique.mockImplementation(async () => ({
      value: '[2000,4000]',
    }))
    const est = await estimateDiscursiveGrading(2)
    expect(est.pendingCount).toBe(2)
    expect(est.avgMsPerQuestion).toBe(3000)
    expect(est.sampleCount).toBe(2)
    expect(est.estimatedSeconds).toBe(6)

    const neg = await estimateDiscursiveGrading(-3)
    expect(neg.pendingCount).toBe(0)
    expect(neg.estimatedSeconds).toBe(1)
  })
})
