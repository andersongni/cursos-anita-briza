import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  mouseAccuracyAttempt: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma }))

import {
  buildMouseAccuracyRanking,
  listMouseAccuracyRanking,
} from './mouse-accuracy-ranking'

const attempt = {
  id: 'a1',
  student_id: 's1',
  duration_ms: 60_000,
  hits: 20,
  misses: 2,
  expired: 1,
  points: 50,
  accuracy: 90.9,
  score: 95,
  max_combo: 12,
  avg_reaction_ms: 420,
  completed_at: new Date('2026-11-12T12:00:00.000Z'),
  student: { full_name: 'Ana', username: 'ana' },
}

describe('mouse-accuracy-ranking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista ranking admin', async () => {
    prisma.mouseAccuracyAttempt.findMany.mockResolvedValueOnce([attempt])
    const { rows, totalAttempts } = await listMouseAccuracyRanking()
    expect(totalAttempts).toBe(1)
    expect(rows[0]?.rank).toBe(1)
    expect(rows[0]?.fullName).toBe('Ana')
    expect(rows[0]?.score).toBe(95)
  })

  it('monta top 10 e posição atual do aluno', async () => {
    prisma.mouseAccuracyAttempt.findMany.mockResolvedValueOnce([attempt])
    const ranking = await buildMouseAccuracyRanking({
      studentId: 's1',
      currentAttemptId: 'a1',
      currentScore: 95,
    })
    expect(ranking.totalAttempts).toBe(1)
    expect(ranking.me.isCurrentAttempt).toBe(true)
    expect(ranking.top[0]?.isCurrentAttempt).toBe(true)
  })

  it('fallback quando tentativa atual não aparece na lista', async () => {
    prisma.mouseAccuracyAttempt.findMany.mockResolvedValueOnce([])
    const ranking = await buildMouseAccuracyRanking({
      studentId: 's1',
      currentAttemptId: 'missing',
      currentScore: 10,
    })
    expect(ranking.me.attemptId).toBe('missing')
    expect(ranking.me.score).toBe(10)
    expect(ranking.me.rank).toBe(1)
  })
})
