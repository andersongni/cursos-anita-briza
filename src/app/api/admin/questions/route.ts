import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { resolveAdminCourseId } from '@/lib/courses'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const dimension_id = searchParams.get('dimension_id')
    const format = searchParams.get('format')
    const active = searchParams.get('active')
    const courseId = searchParams.get('courseId') || (await resolveAdminCourseId())

    const where: Record<string, unknown> = { course_id: courseId }
    if (type) where.type = type
    if (dimension_id) where.dimension_id = dimension_id
    if (format) where.format = format
    if (active !== null) where.active = active === 'true'

    const questions = await prisma.question.findMany({
      where,
      include: { dimension: true, options: true },
      orderBy: { created_at: 'desc' },
    })

    return NextResponse.json({ questions, courseId })
  } catch (error: unknown) {
    console.error('Error fetching questions:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json()
    const {
      type,
      dimension_id,
      question_text,
      options,
      active,
      format: rawFormat,
      expected_answer,
    } = body

    const format =
      rawFormat === 'DISCURSIVE' ? 'DISCURSIVE' : 'MULTIPLE_CHOICE'

    if (!question_text || typeof question_text !== 'string' || !question_text.trim()) {
      return NextResponse.json({ error: 'Texto da pergunta é obrigatório' }, { status: 400 })
    }

    if (format === 'MULTIPLE_CHOICE') {
      if (!Array.isArray(options) || options.length !== 5) {
        return NextResponse.json({ error: 'Exactly 5 options required' }, { status: 400 })
      }
      const correctOptions = options.filter(
        (o: { is_correct?: boolean }) => o.is_correct
      )
      if (correctOptions.length !== 1) {
        return NextResponse.json(
          { error: 'Exactly 1 correct option required' },
          { status: 400 }
        )
      }
    } else {
      const expected =
        typeof expected_answer === 'string' ? expected_answer.trim() : ''
      if (!expected) {
        return NextResponse.json(
          {
            error:
              'Informe os critérios ou exemplos aceitos para corrigir a discursiva',
          },
          { status: 400 }
        )
      }
    }

    const courseId = await resolveAdminCourseId(
      typeof body.courseId === 'string' ? body.courseId : null
    )

    const dimension = await prisma.dimension.findFirst({
      where: { id: dimension_id, course_id: courseId },
    })
    if (!dimension) {
      return NextResponse.json(
        { error: 'Tema inválido para o curso selecionado' },
        { status: 400 }
      )
    }

    const question = await prisma.question.create({
      data: {
        course_id: courseId,
        type,
        format,
        dimension_id,
        question_text: question_text.trim(),
        expected_answer:
          format === 'DISCURSIVE'
            ? String(expected_answer).trim()
            : null,
        active: active !== false,
        ...(format === 'MULTIPLE_CHOICE'
          ? { options: { create: options } }
          : {}),
      },
      include: { options: true },
    })

    return NextResponse.json({ question })
  } catch (error: unknown) {
    console.error('Error creating question:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
