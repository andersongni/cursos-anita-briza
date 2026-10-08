import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { resolveAdminCourseId } from '@/lib/courses'
import {
  QUESTION_TRANSFER_KIND,
  QUESTION_TRANSFER_VERSION,
  type QuestionTransferFile,
  type TransferQuestion,
} from '@/lib/assessment/question-transfer'

export async function POST(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json().catch(() => ({}))
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id: unknown): id is string => typeof id === 'string' && id.trim())
      : []

    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'Selecione ao menos uma pergunta para exportar' },
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

    const rows = await prisma.question.findMany({
      where: { id: { in: ids }, course_id: courseId },
      include: {
        dimension: { select: { name: true } },
        options: {
          orderBy: { option_key: 'asc' },
          select: {
            option_key: true,
            option_text: true,
            is_correct: true,
            explanation: true,
          },
        },
      },
      orderBy: { created_at: 'asc' },
    })

    if (rows.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma das perguntas selecionadas foi encontrada neste curso' },
        { status: 404 }
      )
    }

    const questions: TransferQuestion[] = rows.map((q) => ({
      type: q.type,
      format: q.format === 'DISCURSIVE' ? 'DISCURSIVE' : 'MULTIPLE_CHOICE',
      question_text: q.question_text,
      expected_answer: q.expected_answer,
      active: q.active,
      dimension_name: q.dimension.name,
      options: q.options.map((o) => ({
        option_key: o.option_key,
        option_text: o.option_text,
        is_correct: o.is_correct,
        explanation: o.explanation,
      })),
    }))

    const payload: QuestionTransferFile = {
      kind: QUESTION_TRANSFER_KIND,
      version: QUESTION_TRANSFER_VERSION,
      exportedAt: new Date().toISOString(),
      courseSlug: course.slug,
      courseName: course.name,
      questions,
    }

    const missing = ids.length - rows.length
    return NextResponse.json({
      file: payload,
      exported: rows.length,
      missing,
    })
  } catch (error: unknown) {
    console.error('Error exporting questions:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
