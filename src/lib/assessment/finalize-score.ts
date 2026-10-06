import { prisma } from '@/lib/db'
import { getAssessmentSettings } from '@/lib/settings/assessment'

export type ScoreBreakdown = {
  mcAvg: number
  discursiveAvg: number
  mcWeight: number
  discursiveWeight: number
  score: number
  passed: boolean
  mcCorrect: number
  mcWrong: number
  pendingDiscursive: number
  gradedDiscursive: number
  totalDiscursive: number
}

/** Calcula médias e nota ponderada a partir das respostas já corrigidas. */
export function computeScoreBreakdown(
  questions: Array<{ id: string; format: string }>,
  answers: Array<{
    assessment_question_id: string
    selected_option?: string | null
    score_percent?: number | null
    is_correct?: boolean | null
  }>,
  correctOptionByQuestion: Map<string, string>,
  weights: { mcWeightPercent: number; discursiveWeightPercent: number; passingScore: number }
): ScoreBreakdown {
  const mcQuestions = questions.filter((q) => q.format !== 'DISCURSIVE')
  const discursiveQuestions = questions.filter((q) => q.format === 'DISCURSIVE')

  const answerByQ = new Map(answers.map((a) => [a.assessment_question_id, a]))

  let mcCorrect = 0
  let mcWrong = 0
  const mcScores: number[] = []

  for (const q of mcQuestions) {
    const ans = answerByQ.get(q.id)
    const selected = ans?.selected_option
    const correct = correctOptionByQuestion.get(q.id)
    const isCorrect =
      ans?.is_correct != null
        ? ans.is_correct
        : Boolean(selected) && selected === correct
    const scorePercent =
      typeof ans?.score_percent === 'number'
        ? ans.score_percent
        : isCorrect
          ? 100
          : 0
    mcScores.push(scorePercent)
    if (selected) {
      if (isCorrect) mcCorrect++
      else mcWrong++
    } else {
      mcWrong++
    }
  }

  let gradedDiscursive = 0
  let pendingDiscursive = 0
  const discursiveScores: number[] = []

  for (const q of discursiveQuestions) {
    const ans = answerByQ.get(q.id)
    if (ans && typeof ans.score_percent === 'number') {
      gradedDiscursive++
      discursiveScores.push(ans.score_percent)
    } else {
      pendingDiscursive++
    }
  }

  const mcAvg =
    mcQuestions.length > 0
      ? mcScores.reduce((s, n) => s + n, 0) / mcQuestions.length
      : 0
  const discursiveAvg =
    discursiveScores.length > 0
      ? discursiveScores.reduce((s, n) => s + n, 0) / discursiveScores.length
      : 0

  let mcWeight = weights.mcWeightPercent
  let discWeight = weights.discursiveWeightPercent
  if (mcQuestions.length === 0 && discursiveQuestions.length > 0) {
    mcWeight = 0
    discWeight = 100
  } else if (discursiveQuestions.length === 0 && mcQuestions.length > 0) {
    mcWeight = 100
    discWeight = 0
  }

  // Enquanto houver discursiva pendente, a nota final não é considerada definitiva
  const score =
    pendingDiscursive > 0
      ? (mcAvg * mcWeight) / 100 // parcial só para exibição interna se necessário
      : (mcAvg * mcWeight) / 100 + (discursiveAvg * discWeight) / 100

  const passed =
    pendingDiscursive === 0 && score >= weights.passingScore

  return {
    mcAvg,
    discursiveAvg,
    mcWeight,
    discursiveWeight: discWeight,
    score: Math.round(score * 10) / 10,
    passed,
    mcCorrect,
    mcWrong,
    pendingDiscursive,
    gradedDiscursive,
    totalDiscursive: discursiveQuestions.length,
  }
}

/**
 * Se todas as discursivas tiverem nota, finaliza a avaliação (COMPLETED + passed).
 * Retorna null se ainda houver pendência.
 */
export async function tryFinalizeAssessment(assessmentId: string) {
  const assessment = await prisma.assessment.findUnique({
    where: { id: assessmentId },
    include: {
      questions: true,
      answers: true,
    },
  })
  if (!assessment) return null
  if (assessment.status !== 'AWAITING_GRADING') {
    return null
  }

  const settings = await getAssessmentSettings(
    assessment.type.toLowerCase() === 'prova' ? 'prova' : 'simulado',
    assessment.course_id
  )

  const correctOptionByQuestion = new Map(
    assessment.questions.map((q) => [q.id, q.correct_option])
  )

  const breakdown = computeScoreBreakdown(
    assessment.questions,
    assessment.answers,
    correctOptionByQuestion,
    {
      mcWeightPercent: settings.mcWeightPercent,
      discursiveWeightPercent: settings.discursiveWeightPercent,
      passingScore: settings.passingScore,
    }
  )

  if (breakdown.pendingDiscursive > 0) {
    return { finalized: false as const, breakdown, assessment }
  }

  const updated = await prisma.assessment.update({
    where: { id: assessmentId },
    data: {
      status: 'COMPLETED',
      score: breakdown.score,
      correct_count: breakdown.mcCorrect,
      wrong_count: breakdown.mcWrong,
      passed: breakdown.passed,
      completed_at: assessment.completed_at ?? new Date(),
    },
  })

  return { finalized: true as const, breakdown, assessment: updated }
}
