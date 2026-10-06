import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { tryFinalizeAssessment } from '@/lib/assessment/finalize-score'

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdmin()
    const { id: assessmentId } = await params
    const body = await req.json()

    const assessmentQuestionId =
      body.assessment_question_id || body.assessmentQuestionId
    const scoreRaw = Number(body.score_percent ?? body.scorePercent ?? body.score)
    const feedback =
      typeof body.grading_feedback === 'string'
        ? body.grading_feedback.trim()
        : typeof body.feedback === 'string'
          ? body.feedback.trim()
          : ''

    if (!assessmentQuestionId) {
      return NextResponse.json(
        { error: 'Informe a questão discursiva' },
        { status: 400 }
      )
    }
    if (!Number.isFinite(scoreRaw) || scoreRaw < 0 || scoreRaw > 100) {
      return NextResponse.json(
        { error: 'Nota deve ser um número entre 0 e 100' },
        { status: 400 }
      )
    }

    const scorePercent = Math.round(scoreRaw * 10) / 10

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessmentId },
      include: {
        questions: {
          where: { id: assessmentQuestionId },
        },
        answers: {
          where: { assessment_question_id: assessmentQuestionId },
        },
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }

    if (assessment.status !== 'AWAITING_GRADING') {
      return NextResponse.json(
        {
          error:
            'Somente avaliações aguardando correção de discursivas podem ser pontuadas aqui',
        },
        { status: 400 }
      )
    }

    const question = assessment.questions[0]
    if (!question || question.format !== 'DISCURSIVE') {
      return NextResponse.json(
        { error: 'Questão discursiva não encontrada nesta avaliação' },
        { status: 404 }
      )
    }

    const existing = assessment.answers[0]
    const gradeData = {
      score_percent: scorePercent,
      grading_feedback:
        feedback ||
        `Nota atribuída pelo administrador: ${scorePercent}%.`,
      is_correct: scorePercent >= 70,
      answered_at: existing?.answered_at ?? new Date(),
    }

    if (existing) {
      await prisma.assessmentAnswer.update({
        where: { id: existing.id },
        data: gradeData,
      })
    } else {
      await prisma.assessmentAnswer.create({
        data: {
          assessment_id: assessmentId,
          assessment_question_id: assessmentQuestionId,
          text_answer: null,
          ...gradeData,
        },
      })
    }

    const result = await tryFinalizeAssessment(assessmentId)

    return NextResponse.json({
      success: true,
      score_percent: scorePercent,
      finalized: result?.finalized ?? false,
      pendingDiscursive: result?.breakdown.pendingDiscursive ?? null,
      assessment: result?.assessment
        ? {
            id: result.assessment.id,
            status: result.assessment.status,
            score: result.assessment.score,
            passed: result.assessment.passed,
          }
        : null,
      breakdown: result?.breakdown ?? null,
    })
  } catch (error: unknown) {
    console.error('Grade discursive error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao salvar nota' },
      { status: err.status || 500 }
    )
  }
}
