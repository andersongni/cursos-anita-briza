import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { getAssessmentSettings } from '@/lib/settings/assessment'
import { computeScoreBreakdown } from '@/lib/assessment/finalize-score'
import { gradeDiscursiveAnswer } from '@/lib/assessment/grade-discursive'

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

    for (const question of assessment.questions) {
      const answer = assessment.answers.find(
        (a) => a.assessment_question_id === question.id
      )

      if (question.format === 'DISCURSIVE') {
        const text = answer?.text_answer?.trim() || ''
        const grade = await gradeDiscursiveAnswer({
          questionText: question.question_text_snapshot,
          expectedAnswer: question.expected_answer_snapshot || '',
          studentAnswer: text,
        })
        if (answer) {
          await prisma.assessmentAnswer.update({
            where: { id: answer.id },
            data: {
              score_percent: grade.scorePercent,
              grading_feedback: grade.feedback,
              is_correct: grade.scorePercent >= 70,
              answered_at: text
                ? answer.answered_at ?? new Date()
                : answer.answered_at,
            },
          })
        }
        continue
      }

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
        (completedAt.getTime() - new Date(assessment.started_at).getTime()) /
          1000
      )
    }

    const hasMc = assessment.questions.some((q) => q.format !== 'DISCURSIVE')

    const updatedAssessment = await prisma.assessment.update({
      where: { id: assessment_id },
      data: {
        status: 'COMPLETED',
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        score: breakdown.score,
        correct_count: breakdown.mcCorrect,
        wrong_count: breakdown.mcWrong,
        passed: breakdown.passed,
      },
    })

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
        awaiting_grading: false,
        review_available: hasMc,
        scoring: {
          mcWeight: breakdown.mcWeight,
          discursiveWeight: breakdown.discursiveWeight,
          mcAvg: Math.round(breakdown.mcAvg * 10) / 10,
          discursiveAvg: Math.round(breakdown.discursiveAvg * 10) / 10,
          pendingDiscursive: 0,
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
