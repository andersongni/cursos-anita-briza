import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'

export async function POST(req: Request) {
  try {
    const { user } = await verifyAuth()
    const body = await req.json()
    const assessment_id = body.assessment_id || body.assessmentId
    const assessment_question_id = body.assessment_question_id || body.questionId
    const selected_option = body.selected_option ?? body.optionId
    const text_answer =
      typeof body.text_answer === 'string'
        ? body.text_answer
        : typeof body.textAnswer === 'string'
          ? body.textAnswer
          : undefined
    const flagged_for_review = body.flagged_for_review ?? body.isFlagged

    if (!assessment_id || !assessment_question_id) {
      return NextResponse.json(
        { error: 'Faltando parâmetros obrigatórios' },
        { status: 400 }
      )
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessment_id },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }

    if (assessment.student_id !== user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    if (assessment.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Avaliação não está em andamento' },
        { status: 400 }
      )
    }

    if (assessment.deadline_at && new Date() > assessment.deadline_at) {
      return NextResponse.json(
        { error: 'Tempo esgotado para esta avaliação' },
        { status: 400 }
      )
    }

    const question = await prisma.assessmentQuestion.findFirst({
      where: { id: assessment_question_id, assessment_id },
      select: { format: true },
    })
    if (!question) {
      return NextResponse.json({ error: 'Questão não encontrada' }, { status: 404 })
    }

    const data: {
      selected_option?: string | null
      text_answer?: string | null
      flagged_for_review?: boolean
      answered_at?: Date
    } = {}

    if (flagged_for_review !== undefined) {
      data.flagged_for_review = Boolean(flagged_for_review)
    }

    if (question.format === 'DISCURSIVE') {
      if (text_answer !== undefined) {
        const trimmed = text_answer.trim()
        data.text_answer = trimmed || null
        if (trimmed) data.answered_at = new Date()
      }
    } else if (selected_option !== undefined) {
      data.selected_option = selected_option
      if (selected_option) data.answered_at = new Date()
    }

    await prisma.assessmentAnswer.update({
      where: {
        assessment_id_assessment_question_id: {
          assessment_id,
          assessment_question_id,
        },
      },
      data,
    })

    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Answer assessment error:', error)
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err.message || 'Erro ao salvar resposta' },
      { status: 500 }
    )
  }
}
