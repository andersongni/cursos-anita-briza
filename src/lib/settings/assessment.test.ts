import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  systemSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/courses/ensure-courses', () => ({
  ensureCourses: vi.fn(async () => ({ informaticaId: 'inf-1' })),
}))

import {
  getAssessmentSettings,
  getProvaUnlockState,
  setAssessmentSettingsForCourse,
} from './assessment'

describe('getAssessmentSettings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('usa defaults e curso padrão', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue(null)
    const s = await getAssessmentSettings()
    expect(s.questionCount).toBe(40)
    expect(s.mcWeightPercent).toBe(80)
    expect(s.discursiveWeightPercent).toBe(20)
  })

  it('normaliza pesos e lê valores do curso', async () => {
    prisma.systemSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      const map: Record<string, string> = {
        'assessment.course.c1.question_count': '10',
        'assessment.course.c1.time_limit_minutes': '30',
        'assessment.course.c1.passing_score': '60',
        'assessment.course.c1.mc_weight_percent': '70',
        'assessment.course.c1.discursive_weight_percent': '50',
        'assessment.course.c1.discursive_count': '3',
      }
      return map[where.key] ? { value: map[where.key] } : null
    })
    const s = await getAssessmentSettings('prova', 'c1')
    expect(s.questionCount).toBe(10)
    expect(s.mcWeightPercent).toBe(70)
    expect(s.discursiveWeightPercent).toBe(30)
    expect(s.discursiveCount).toBe(3)
  })

  it('restaura 80/20 quando ambos pesos são 0', async () => {
    prisma.systemSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key.includes('mc_weight')) return { value: '0' }
      if (where.key.includes('discursive_weight')) return { value: '0' }
      return null
    })
    const s = await getAssessmentSettings('simulado', 'c1')
    expect(s.mcWeightPercent).toBe(80)
    expect(s.discursiveWeightPercent).toBe(20)
  })

  it('usa fallback legado global de prova', async () => {
    prisma.systemSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      const map: Record<string, string> = {
        'assessment.prova.question_count': '8',
        'assessment.prova.time_limit_minutes': '45',
        'assessment.prova.passing_score': '55',
      }
      return map[where.key] ? { value: map[where.key] } : null
    })
    const s = await getAssessmentSettings('prova', 'c1')
    expect(s.questionCount).toBe(8)
    expect(s.timeLimitMinutes).toBe(45)
    expect(s.passingScore).toBe(55)
  })
})


describe('setAssessmentSettingsForCourse', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prisma.systemSetting.findUnique.mockResolvedValue(null)
    prisma.systemSetting.upsert.mockResolvedValue({})
  })

  it('grava valores normalizados', async () => {
    const result = await setAssessmentSettingsForCourse(
      'c1',
      {
        questionCount: 5.9,
        timeLimitMinutes: 15,
        passingScore: 200,
        mcWeightPercent: 90,
        discursiveWeightPercent: 5,
        discursiveCount: 1,
      },
      'user-1'
    )
    expect(result.questionCount).toBe(5)
    expect(result.passingScore).toBe(100)
    expect(result.discursiveWeightPercent).toBe(10)
    expect(prisma.systemSetting.upsert).toHaveBeenCalledTimes(6)
  })

  it('mantém current quando input inválido', async () => {
    const result = await setAssessmentSettingsForCourse('c1', {
      questionCount: Number.NaN,
      timeLimitMinutes: Number.NaN,
      passingScore: Number.NaN,
      mcWeightPercent: Number.NaN,
      discursiveWeightPercent: Number.NaN,
      discursiveCount: Number.NaN,
    })
    expect(result.questionCount).toBe(40)
    expect(result.mcWeightPercent).toBe(80)
  })
})

describe('getProvaUnlockState', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fechado sem unlock', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue(null)
    const state = await getProvaUnlockState('other')
    expect(state.open).toBe(false)
    expect(state.unlockUntil).toBeNull()
  })

  it('aberto com data futura e legado em informática', async () => {
    const future = new Date(Date.now() + 60_000).toISOString()
    prisma.systemSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === 'assessment.prova.unlock_until.c1') {
        return { value: JSON.stringify(future) }
      }
      return null
    })
    const open = await getProvaUnlockState('c1')
    expect(open.open).toBe(true)
    expect(open.remainingMs).toBeGreaterThan(0)

    prisma.systemSetting.findUnique.mockImplementation(async ({ where }: { where: { key: string } }) => {
      if (where.key === 'assessment.prova.unlock_until') {
        return { value: future }
      }
      return null
    })
    const legacy = await getProvaUnlockState('inf-1')
    expect(legacy.open).toBe(true)
  })

  it('ignora unlock inválido', async () => {
    prisma.systemSetting.findUnique.mockResolvedValue({ value: 'not-a-date' })
    const state = await getProvaUnlockState('c1')
    expect(state.open).toBe(false)

    prisma.systemSetting.findUnique.mockResolvedValue({ value: JSON.stringify({ x: 1 }) })
    expect((await getProvaUnlockState('c1')).open).toBe(false)

    prisma.systemSetting.findUnique.mockResolvedValue({ value: JSON.stringify('') })
    expect((await getProvaUnlockState('c1')).open).toBe(false)
  })
})
