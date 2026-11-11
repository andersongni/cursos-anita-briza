import { prisma } from '@/lib/db'
import { gradeDiscursiveAnswers } from '@/lib/assessment/grade-discursive'
import { tryFinalizeAssessment } from '@/lib/assessment/finalize-score'
import { recordDiscursiveGradingSample } from '@/lib/assessment/grading-latency'

const gradingInFlight = new Set<string>()

/**
 * Corrige discursivas pendentes com IA (1 chamada Gemini em lote) e finaliza a nota.
 */
export async function processPendingDiscursiveGrading(
  assessmentId: string
): Promise<void> {
  if (gradingInFlight.has(assessmentId)) return
  gradingInFlight.add(assessmentId)

  try {
    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: true,
        answers: true,
      },
    })

    if (!assessment) return
    if (assessment.status !== 'AWAITING_GRADING') return

    const discursiveQuestions = assessment.questions.filter(
      (q) => q.format === 'DISCURSIVE'
    )
    if (discursiveQuestions.length === 0) {
      await tryFinalizeAssessment(assessmentId)
      return
    }

    const pending: Array<{
      answerId: string
      questionText: string
      expectedAnswer: string
      studentAnswer: string
      answeredAt: Date | null
    }> = []

    for (const question of discursiveQuestions) {
      const answer = assessment.answers.find(
        (a) => a.assessment_question_id === question.id
      )
      if (!answer) continue
      if (typeof answer.score_percent === 'number') continue
      pending.push({
        answerId: answer.id,
        questionText: question.question_text_snapshot,
        expectedAnswer: question.expected_answer_snapshot || '',
        studentAnswer: answer.text_answer?.trim() || '',
        answeredAt: answer.answered_at,
      })
    }

    if (pending.length === 0) {
      await tryFinalizeAssessment(assessmentId)
      return
    }

    const started = Date.now()
    const grades = await gradeDiscursiveAnswers(
      pending.map((p) => ({
        id: p.answerId,
        questionText: p.questionText,
        expectedAnswer: p.expectedAnswer,
        studentAnswer: p.studentAnswer,
      }))
    )

    await Promise.all(
      pending.map(async (p) => {
        const grade = grades.get(p.answerId)
        if (!grade) return
        const text = p.studentAnswer
        await prisma.assessmentAnswer.update({
          where: { id: p.answerId },
          data: {
            score_percent: grade.scorePercent,
            grading_feedback: grade.feedback,
            is_correct: grade.scorePercent >= 70,
            answered_at: text ? p.answeredAt ?? new Date() : p.answeredAt,
          },
        })
      })
    )

    await recordDiscursiveGradingSample(Date.now() - started, pending.length)
    await tryFinalizeAssessment(assessmentId)
  } finally {
    gradingInFlight.delete(assessmentId)
  }
}
