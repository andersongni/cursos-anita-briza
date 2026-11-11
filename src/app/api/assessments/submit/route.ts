import { NextResponse, after } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { getAssessmentSettings } from '@/lib/settings/assessment'
import { computeScoreBreakdown } from '@/lib/assessment/finalize-score'
import { processPendingDiscursiveGrading } from '@/lib/assessment/process-discursive-grading'
import {
  estimateDiscursiveGrading,
  formatGradingEta,
} from '@/lib/assessment/grading-latency'

/** Tempo para a correção em background (Gemini) após a resposta HTTP. */
export const maxDuration = 300

export async function POST(req: Request) {
  try {
    const { user } = await verifyAuth()
    const body = await req.json()
    const assessment_id = body.assessment_id || body.assessmentId

    if (!assessment_id) {
      return NextResponse.json(
        { error: 'ID da avaliação não fornecido' },
        { status: 400 }
      )
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessment_id },
      include: {
        questions: true,
        answers: true,
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }

    if (assessment.student_id !== user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    if (assessment.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Apenas avaliações em andamento podem ser enviadas' },
        { status: 400 }
      )
    }

    if (assessment.total_questions <= 0 || assessment.questions.length === 0) {
      return NextResponse.json(
        { error: 'Esta avaliação não possui questões e não pode ser finalizada.' },
        { status: 400 }
      )
    }

    const settings = await getAssessmentSettings(
      assessment.type.toLowerCase() === 'prova' ? 'prova' : 'simulado',
      assessment.course_id
    )

    const discursiveQuestions = assessment.questions.filter(
      (q) => q.format === 'DISCURSIVE'
    )
    const hasDiscursive = discursiveQuestions.length > 0

    // Múltipla escolha: correção imediata. Discursivas: em background.
    for (const question of assessment.questions) {
      if (question.format === 'DISCURSIVE') continue

      const answer = assessment.answers.find(
        (a) => a.assessment_question_id === question.id
      )
      const selected = answer?.selected_option
      const isCorrect = Boolean(selected) && selected === question.correct_option
      const scorePercent = isCorrect ? 100 : 0
      if (answer) {
        await prisma.assessmentAnswer.update({
          where: { id: answer.id },
          data: {
            is_correct: isCorrect,
            score_percent: scorePercent,
            grading_feedback: isCorrect
              ? 'Resposta correta.'
              : selected
                ? 'Resposta incorreta.'
                : 'Sem resposta.',
          },
        })
      }
    }

    const refreshedAnswers = await prisma.assessmentAnswer.findMany({
      where: { assessment_id },
    })

    const correctOptionByQuestion = new Map(
      assessment.questions.map((q) => [q.id, q.correct_option])
    )

    const breakdown = computeScoreBreakdown(
      assessment.questions,
      refreshedAnswers,
      correctOptionByQuestion,
      {
        mcWeightPercent: settings.mcWeightPercent,
        discursiveWeightPercent: settings.discursiveWeightPercent,
        passingScore: settings.passingScore,
      }
    )

    const completedAt = new Date()
    let durationSeconds = 0
    if (assessment.started_at) {
      durationSeconds = Math.floor(
        (completedAt.getTime() - new Date(assessment.started_at).getTime()) / 1000
      )
    }

    const hasMc = assessment.questions.some((q) => q.format !== 'DISCURSIVE')
    const status = hasDiscursive ? 'AWAITING_GRADING' : 'COMPLETED'

    const updatedAssessment = await prisma.assessment.update({
      where: { id: assessment_id },
      data: {
        status,
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        // Nota definitiva só quando não há discursivas pendentes
        score: hasDiscursive ? null : breakdown.score,
        correct_count: breakdown.mcCorrect,
        wrong_count: breakdown.mcWrong,
        passed: hasDiscursive ? null : breakdown.passed,
      },
    })

    let gradingEta: {
      pendingCount: number
      estimatedSeconds: number
      etaLabel: string
      sampleCount: number
    } | null = null

    if (hasDiscursive) {
      const eta = await estimateDiscursiveGrading(discursiveQuestions.length)
      gradingEta = {
        pendingCount: eta.pendingCount,
        estimatedSeconds: eta.estimatedSeconds,
        etaLabel: formatGradingEta(eta.estimatedSeconds),
        sampleCount: eta.sampleCount,
      }

      const idForAfter = assessment_id
      after(async () => {
        try {
          await processPendingDiscursiveGrading(idForAfter)
        } catch (err) {
          console.error(
            `[submit] falha na correção em background de ${idForAfter}:`,
            err
          )
        }
      })
    }

    return NextResponse.json({
      success: true,
      assessment: {
        id: updatedAssessment.id,
        type: updatedAssessment.type,
        status: updatedAssessment.status,
        score: updatedAssessment.score,
        passed: updatedAssessment.passed,
        correct_count: updatedAssessment.correct_count,
        wrong_count: updatedAssessment.wrong_count,
        total_questions: updatedAssessment.total_questions,
        awaiting_grading: hasDiscursive,
        review_available: hasMc && !hasDiscursive,
        grading_eta: gradingEta,
        scoring: {
          mcWeight: breakdown.mcWeight,
          discursiveWeight: breakdown.discursiveWeight,
          mcAvg: Math.round(breakdown.mcAvg * 10) / 10,
          discursiveAvg: Math.round(breakdown.discursiveAvg * 10) / 10,
          pendingDiscursive: hasDiscursive ? discursiveQuestions.length : 0,
        },
      },
    })
  } catch (error: unknown) {
    console.error('Submit assessment error:', error)
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err.message || 'Erro ao enviar avaliação' },
      { status: 500 }
    )
  }
}
