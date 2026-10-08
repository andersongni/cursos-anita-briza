import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { resolveAdminCourseId } from '@/lib/courses'
import {
  isQuestionTransferFile,
  normalizeQuestionText,
  validateTransferQuestion,
} from '@/lib/assessment/question-transfer'

type SkippedItem = {
  index: number
  question_text: string
  reason: string
}

export async function POST(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Arquivo inválido' }, { status: 400 })
    }

    const file = (body as { file?: unknown }).file ?? body
    if (!isQuestionTransferFile(file)) {
      return NextResponse.json(
        {
          error:
            'Arquivo inválido. Use um JSON exportado por esta plataforma (kind/version corretos).',
        },
        { status: 400 }
      )
    }

    const courseId = await resolveAdminCourseId(
      typeof (body as { courseId?: unknown }).courseId === 'string'
        ? ((body as { courseId: string }).courseId)
        : null
    )

    const course = await prisma.course.findUnique({
      where: { id: courseId },
      select: { id: true, slug: true, name: true },
    })
    if (!course) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 })
    }

    const dimensions = await prisma.dimension.findMany({
      where: { course_id: courseId },
      select: { id: true, name: true },
    })
    const dimensionByName = new Map(
      dimensions.map((d) => [d.name.trim().toLowerCase(), d])
    )

    const existing = await prisma.question.findMany({
      where: { course_id: courseId },
      select: { type: true, format: true, question_text: true },
    })
    const existingKeys = new Set(
      existing.map(
        (q) =>
          `${q.type}|${q.format === 'DISCURSIVE' ? 'DISCURSIVE' : 'MULTIPLE_CHOICE'}|${normalizeQuestionText(q.question_text).toLowerCase()}`
      )
    )

    const imported: string[] = []
    const skipped: SkippedItem[] = []
    const errors: SkippedItem[] = []

    for (let i = 0; i < file.questions.length; i++) {
      const validated = validateTransferQuestion(file.questions[i], i)
      if (!validated.ok) {
        errors.push({
          index: i + 1,
          question_text: '',
          reason: validated.error,
        })
        continue
      }

      const q = validated.question
      const preview =
        q.question_text.length > 120
          ? `${q.question_text.slice(0, 117)}...`
          : q.question_text

      const dupKey = `${q.type}|${q.format}|${q.question_text.toLowerCase()}`
      if (existingKeys.has(dupKey)) {
        skipped.push({
          index: i + 1,
          question_text: preview,
          reason: 'Já existe neste curso (mesmo tipo, formato e texto)',
        })
        continue
      }

      const dimension = dimensionByName.get(q.dimension_name.toLowerCase())
      if (!dimension) {
        errors.push({
          index: i + 1,
          question_text: preview,
          reason: `Tema "${q.dimension_name}" não encontrado no curso ativo`,
        })
        continue
      }

      try {
        await prisma.question.create({
          data: {
            course_id: courseId,
            type: q.type,
            format: q.format,
            dimension_id: dimension.id,
            question_text: q.question_text,
            expected_answer: q.format === 'DISCURSIVE' ? q.expected_answer : null,
            active: q.active,
            ...(q.format === 'MULTIPLE_CHOICE'
              ? {
                  options: {
                    create: q.options.map((o) => ({
                      option_key: o.option_key,
                      option_text: o.option_text,
                      is_correct: o.is_correct,
                      explanation: o.explanation,
                    })),
                  },
                }
              : {}),
          },
        })
        existingKeys.add(dupKey)
        imported.push(preview)
      } catch (err) {
        errors.push({
          index: i + 1,
          question_text: preview,
          reason: err instanceof Error ? err.message : 'Falha ao gravar',
        })
      }
    }

    return NextResponse.json({
      courseSlug: course.slug,
      courseName: course.name,
      sourceCourseSlug: file.courseSlug,
      total: file.questions.length,
      imported: imported.length,
      skipped: skipped.length,
      errors: errors.length,
      importedQuestions: imported,
      skippedQuestions: skipped,
      errorQuestions: errors,
    })
  } catch (error: unknown) {
    console.error('Error importing questions:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
