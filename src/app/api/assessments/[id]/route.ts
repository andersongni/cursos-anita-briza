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

    let responseAssessment: any = { ...assessment }

    // Prova: aluno nunca vê gabarito/explicações por esta rota (só o admin)
    if (assessment.type === 'PROVA' && profile.role !== 'ADMIN') {
      responseAssessment.questions = assessment.questions.map((q) => {
        const {
          correct_option,
          option_a_explanation,
          option_b_explanation,
          option_c_explanation,
          option_d_explanation,
          option_e_explanation,
          ...rest
        } = q
        return {
          ...rest,
          correct_option: null,
          option_a_explanation: null,
          option_b_explanation: null,
          option_c_explanation: null,
          option_d_explanation: null,
          option_e_explanation: null,
        }
      })
    }

    return NextResponse.json({ assessment: responseAssessment })
  } catch (error: any) {
    console.error('Get assessment error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar avaliação' },
      { status: error.status || 500 }
    )
  }
}
