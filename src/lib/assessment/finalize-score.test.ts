import { beforeEach, describe, expect, it, vi } from 'vitest'

const prisma = vi.hoisted(() => ({
  assessment: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}))

vi.mock('@/lib/db', () => ({ prisma }))
vi.mock('@/lib/settings/assessment', () => ({
  getAssessmentSettings: vi.fn(async () => ({
    mcWeightPercent: 80,
    discursiveWeightPercent: 20,
    passingScore: 70,
  })),
}))

import { computeScoreBreakdown, tryFinalizeAssessment } from './finalize-score'
import { getAssessmentSettings } from '@/lib/settings/assessment'

describe('computeScoreBreakdown', () => {
  const weights = {
    mcWeightPercent: 80,
    discursiveWeightPercent: 20,
    passingScore: 70,
  }

  it('calcula MC + discursiva', () => {
    const correct = new Map([
      ['q1', 'A'],
      ['q2', 'B'],
    ])
    const result = computeScoreBreakdown(
      [
        { id: 'q1', format: 'MULTIPLE_CHOICE' },
        { id: 'q2', format: 'MULTIPLE_CHOICE' },
        { id: 'q3', format: 'DISCURSIVE' },
      ],
      [
        { assessment_question_id: 'q1', selected_option: 'A' },
        { assessment_question_id: 'q2', selected_option: 'C' },
        { assessment_question_id: 'q3', score_percent: 100 },
      ],
      correct,
      weights
    )
    expect(result.mcCorrect).toBe(1)
    expect(result.mcWrong).toBe(1)
    expect(result.mcAvg).toBe(50)
    expect(result.discursiveAvg).toBe(100)
    expect(result.passed).toBe(false)
    expect(result.pendingDiscursive).toBe(0)
  })

  it('trata MC sem seleção, is_correct e score_percent', () => {
    const correct = new Map([['q1', 'A']])
    const r = computeScoreBreakdown(
      [{ id: 'q1', format: 'MULTIPLE_CHOICE' }],
      [{ assessment_question_id: 'q1', is_correct: true, score_percent: 80 }],
      correct,
      weights
    )
    expect(r.mcWrong).toBe(1)
    expect(r.mcAvg).toBe(80)

    const unanswered = computeScoreBreakdown(
      [{ id: 'q1', format: 'MULTIPLE_CHOICE' }],
      [],
      correct,
      weights
    )
    expect(unanswered.mcWrong).toBe(1)
    expect(unanswered.mcAvg).toBe(0)
  })

  it('ajusta pesos quando só um tipo existe e bloqueia com pendente', () => {
    const onlyMc = computeScoreBreakdown(
      [{ id: 'q1', format: 'MULTIPLE_CHOICE' }],
      [{ assessment_question_id: 'q1', selected_option: 'A', is_correct: true }],
      new Map([['q1', 'A']]),
      weights
    )
    expect(onlyMc.mcWeight).toBe(100)
    expect(onlyMc.passed).toBe(true)

    const onlyDisc = computeScoreBreakdown(
      [{ id: 'd1', format: 'DISCURSIVE' }],
      [{ assessment_question_id: 'd1', score_percent: 90 }],
      new Map(),
      weights
    )
    expect(onlyDisc.discursiveWeight).toBe(100)
    expect(onlyDisc.score).toBe(90)

    const pending = computeScoreBreakdown(
      [
        { id: 'q1', format: 'MULTIPLE_CHOICE' },
        { id: 'd1', format: 'DISCURSIVE' },
      ],
      [{ assessment_question_id: 'q1', selected_option: 'A', is_correct: true }],
      new Map([['q1', 'A']]),
      weights
    )
    expect(pending.pendingDiscursive).toBe(1)
    expect(pending.passed).toBe(false)
  })
})

describe('tryFinalizeAssessment', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('retorna null quando avaliação inexistente ou status inválido', async () => {
    prisma.assessment.findUnique.mockResolvedValueOnce(null)
    expect(await tryFinalizeAssessment('x')).toBeNull()

    prisma.assessment.findUnique.mockResolvedValueOnce({ status: 'IN_PROGRESS' })
    expect(await tryFinalizeAssessment('x')).toBeNull()
  })

  it('não finaliza com discursiva pendente', async () => {
    prisma.assessment.findUnique.mockResolvedValueOnce({
      id: 'a1',
      status: 'AWAITING_GRADING',
      type: 'PROVA',
      course_id: 'c1',
      completed_at: null,
      questions: [
        { id: 'q1', format: 'MULTIPLE_CHOICE', correct_option: 'A' },
        { id: 'd1', format: 'DISCURSIVE', correct_option: null },
      ],
      answers: [{ assessment_question_id: 'q1', selected_option: 'A', is_correct: true }],
    })
    const result = await tryFinalizeAssessment('a1')
    expect(result?.finalized).toBe(false)
    expect(prisma.assessment.update).not.toHaveBeenCalled()
  })

  it('finaliza quando tudo corrigido', async () => {
    prisma.assessment.findUnique.mockResolvedValueOnce({
      id: 'a1',
      status: 'COMPLETED',
      type: 'simulado',
      course_id: 'c1',
      completed_at: new Date('2026-01-01'),
      questions: [
        { id: 'q1', format: 'MULTIPLE_CHOICE', correct_option: 'A' },
        { id: 'd1', format: 'DISCURSIVE', correct_option: null },
      ],
      answers: [
        { assessment_question_id: 'q1', selected_option: 'A', is_correct: true },
        { assessment_question_id: 'd1', score_percent: 100 },
      ],
    })
    prisma.assessment.update.mockResolvedValueOnce({ id: 'a1', status: 'COMPLETED' })
    const result = await tryFinalizeAssessment('a1')
    expect(result?.finalized).toBe(true)
    expect(getAssessmentSettings).toHaveBeenCalledWith('simulado', 'c1')
    expect(prisma.assessment.update).toHaveBeenCalled()
  })

  it('define completed_at quando ainda nulo', async () => {
    prisma.assessment.findUnique.mockResolvedValueOnce({
      id: 'a2',
      status: 'AWAITING_GRADING',
      type: 'PROVA',
      course_id: 'c1',
      completed_at: null,
      questions: [{ id: 'q1', format: 'MULTIPLE_CHOICE', correct_option: 'A' }],
      answers: [
        { assessment_question_id: 'q1', selected_option: 'A', is_correct: true },
      ],
    })
    prisma.assessment.update.mockResolvedValueOnce({ id: 'a2', status: 'COMPLETED' })
    await tryFinalizeAssessment('a2')
    expect(prisma.assessment.update.mock.calls[0][0].data.completed_at).toBeInstanceOf(
      Date
    )
  })
})

