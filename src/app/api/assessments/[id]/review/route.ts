import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await verifyAuth()
    const { id } = await params

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        questions: { orderBy: { question_order: 'asc' } },
        answers: true,
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }

    if (assessment.student_id !== user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    // Revisão liberada para prova e simulado após conclusão (só MC no front)
    if (
      assessment.status !== 'COMPLETED' &&
      assessment.status !== 'AWAITING_GRADING'
    ) {
      return NextResponse.json(
        { error: 'Avaliação ainda não concluída' },
        { status: 400 }
      )
    }

    const mcQuestions = assessment.questions.filter(
      (q) => q.format !== 'DISCURSIVE'
    )
    const mcIds = new Set(mcQuestions.map((q) => q.id))
    const mcAnswers = assessment.answers.filter((a) =>
      mcIds.has(a.assessment_question_id)
    )

    return NextResponse.json({
      assessment: {
        ...assessment,
        questions: mcQuestions,
        answers: mcAnswers,
      },
    })
  } catch (error: unknown) {
    console.error('Review assessment error:', error)
    const err = error as { message?: string }
    return NextResponse.json(
      { error: err.message || 'Erro ao buscar revisão' },
      { status: 500 }
    )
  }
}
