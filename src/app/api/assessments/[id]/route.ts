import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile } = await verifyAuth()
    const { id } = await params

    const assessment = await prisma.assessment.findUnique({
      where: { id },
      include: {
        student: { select: { id: true, full_name: true, username: true } },
        questions: { orderBy: { question_order: 'asc' } },
        answers: true,
      },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }

    if (assessment.student_id !== user.id && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    // Aluno nunca vê gabarito / critérios de correção em prova em andamento
    const hideKeys = profile.role !== 'ADMIN'
    const responseAssessment = hideKeys
      ? {
          ...assessment,
          questions: assessment.questions.map((q) => ({
            ...q,
            correct_option:
              assessment.type === 'PROVA' || assessment.status === 'IN_PROGRESS'
                ? null
                : q.correct_option,
            expected_answer_snapshot: null,
            option_a_explanation:
              assessment.type === 'PROVA' ? null : q.option_a_explanation,
            option_b_explanation:
              assessment.type === 'PROVA' ? null : q.option_b_explanation,
            option_c_explanation:
              assessment.type === 'PROVA' ? null : q.option_c_explanation,
            option_d_explanation:
              assessment.type === 'PROVA' ? null : q.option_d_explanation,
            option_e_explanation:
              assessment.type === 'PROVA' ? null : q.option_e_explanation,
          })),
          answers: assessment.answers.map((a) =>
            assessment.status === 'IN_PROGRESS'
              ? {
                  ...a,
                  score_percent: null,
                  grading_feedback: null,
                  is_correct: null,
                }
              : a
          ),
        }
      : assessment

    return NextResponse.json({ assessment: responseAssessment })
  } catch (error: unknown) {
    console.error('Get assessment error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao buscar avaliação' },
      { status: err.status || 500 }
    )
  }
}
