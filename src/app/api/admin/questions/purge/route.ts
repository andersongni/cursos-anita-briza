import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { resolveAdminCourseId } from '@/lib/courses'

const CONFIRM_WORD = 'APAGAR'

/**
 * Remove todas as perguntas do curso selecionado.
 * Avaliações históricas preservam snapshots; a FK question_id é anulada.
 * O backup obrigatório é gerado/baixado no cliente antes desta chamada.
 */
export async function POST(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json().catch(() => ({}))

    if (typeof body.confirm !== 'string' || body.confirm.trim().toUpperCase() !== CONFIRM_WORD) {
      return NextResponse.json(
        { error: `Confirme digitando ${CONFIRM_WORD} para esvaziar o banco` },
        { status: 400 }
      )
    }

    const courseId = await resolveAdminCourseId(
      typeof body.courseId === 'string' ? body.courseId : null
    )

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, slug: true, name: true },
    })
    if (!course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 })
    }

    const questions = await prisma.question.findMany({
      where: { course_id: courseId },
      select: { id: true },
    })

    if (questions.length === 0) {
      return NextResponse.json({
        success: true,
        deleted: 0,
        courseName: course.name,
        message: 'Não havia perguntas neste curso',
      })
    }

    const ids = questions.map((q) => q.id)

    await prisma.$transaction(async (tx) => {
      await tx.assessmentQuestion.updateMany({
        where: { question_id: { in: ids } },
        data: { question_id: null },
      })
      await tx.question.deleteMany({
        where: { id: { in: ids }, course_id: courseId },
      })
    })

    return NextResponse.json({
      success: true,
      deleted: ids.length,
      courseName: course.name,
      message: `${ids.length} pergunta(s) removida(s) do curso ${course.name}`,
    })
  } catch (error: unknown) {
    console.error('Error purging questions:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
