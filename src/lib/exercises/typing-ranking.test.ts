import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  typingAttempt: {
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma }))

import { buildTypingRanking, listTypingRanking } from './typing-ranking'

const attempt = {
  id: 'a1',
  student_id: 's1',
  duration_ms: 1000,
  error_count: 0,
  wpm: 40,
  score: 90,
  accuracy: 100,
  completed_at: new Date('2026-01-01T00:00:00.000Z'),
  student: { full_name: 'Ana', username: 'ana' },
  passage: { title: 'Texto' },
}

describe('typing-ranking', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('lista ranking admin', async () => {
    prisma.typingAttempt.findMany.mockResolvedValueOnce([attempt])
    const result = await listTypingRanking()
    expect(result.totalAttempts).toBe(1)
    expect(result.rows[0].rank).toBe(1)
    expect(result.rows[0].isCurrentUser).toBe(false)
  })

  it('buildTypingRanking com tentativa atual e fallback', async () => {
    prisma.typingAttempt.findMany.mockResolvedValueOnce([attempt])
    const withMe = await buildTypingRanking({
      studentId: 's1',
      currentAttemptId: 'a1',
      currentDurationMs: 1000,
    })
    expect(withMe.me.isCurrentAttempt).toBe(true)
    expect(withMe.top).toHaveLength(1)

    prisma.typingAttempt.findMany.mockResolvedValueOnce([])
    const missing = await buildTypingRanking({
      studentId: 's2',
      currentAttemptId: 'missing',
      currentDurationMs: 500,
    })
    expect(missing.me.fullName).toBe('Você')
    expect(missing.me.rank).toBe(1)
  })
})
