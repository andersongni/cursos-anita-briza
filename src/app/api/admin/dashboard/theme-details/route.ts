import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { ofActiveStudent } from '@/lib/students/soft-delete'
import { formatFullName } from '@/lib/utils'
import type { Prisma } from '@prisma/client'

export const runtime = 'nodejs'

const OPTION_KEYS = ['A', 'B', 'C', 'D', 'E'] as const

function optionText(
  q: {
    option_a_text: string
    option_b_text: string
    option_c_text: string
    option_d_text: string
    option_e_text: string
  },
  key: string | null | undefined
): string {
  if (!key) return '—'
  const map: Record<string, string> = {
    A: q.option_a_text,
    B: q.option_b_text,
    C: q.option_c_text,
    D: q.option_d_text,
    E: q.option_e_text,
  }
  return map[key.toUpperCase()] ?? '—'
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdmin()

    const { searchParams } = req.nextUrl
    const dimensionId = searchParams.get('dimensionId')?.trim() || null
    const name = searchParams.get('name')?.trim() || ''
    const typeRaw = (searchParams.get('type') || 'ALL').toUpperCase()
    const type =
      typeRaw === 'PROVA' || typeRaw === 'SIMULADO' ? typeRaw : 'ALL'
    const resultRaw = (searchParams.get('result') || 'ALL').toUpperCase()
    const result =
      resultRaw === 'CORRECT' || resultRaw === 'WRONG' || resultRaw === 'BLANK'
        ? resultRaw
        : 'ALL'

    if (!dimensionId && !name) {
      return NextResponse.json(
        { error: 'Informe dimensionId ou name do tema.' },
        { status: 400 }
      )
    }

    const questionWhere: Prisma.AssessmentQuestionWhereInput = dimensionId
      ? {
          OR: [
            { dimension_id: dimensionId },
            ...(name
              ? [{ dimension_id: null as string | null, dimension_name_snapshot: name }]
              : []),
          ],
        }
      : { dimension_name_snapshot: name }

    const resultWhere: Prisma.AssessmentAnswerWhereInput =
      result === 'CORRECT'
        ? { is_correct: true, selected_option: { not: null }, NOT: { selected_option: '' } }
        : result === 'WRONG'
          ? { is_correct: false, selected_option: { not: null }, NOT: { selected_option: '' } }
          : result === 'BLANK'
            ? { OR: [{ selected_option: null }, { selected_option: '' }] }
            : { is_correct: { not: null } }

    const answers = await prisma.assessmentAnswer.findMany({
      where: {
        ...resultWhere,
        assessment: {
          status: 'COMPLETED',
          ...(type === 'ALL' ? { type: { in: ['PROVA', 'SIMULADO'] } } : { type }),
          ...ofActiveStudent,
        },
        assessmentQuestion: questionWhere,
      },
      orderBy: [{ answered_at: 'desc' }, { id: 'desc' }],
      take: 500,
      select: {
        id: true,
        selected_option: true,
        is_correct: true,
        answered_at: true,
        assessment: {
          select: {
            id: true,
            type: true,
            completed_at: true,
            student: {
              select: {
                id: true,
                full_name: true,
                username: true,
              },
            },
          },
        },
        assessmentQuestion: {
          select: {
            id: true,
            question_text_snapshot: true,
            correct_option: true,
            option_a_text: true,
            option_b_text: true,
            option_c_text: true,
            option_d_text: true,
            option_e_text: true,
            dimension_name_snapshot: true,
          },
        },
      },
    })

    const rows = answers.map((a) => {
      const q = a.assessmentQuestion
      const selectedRaw = a.selected_option?.trim() || null
      const selected = selectedRaw?.toUpperCase() ?? null
      const correct = q.correct_option?.toUpperCase() ?? null
      const isBlank = !selectedRaw
      return {
        id: a.id,
        studentId: a.assessment.student.id,
        studentName: formatFullName(a.assessment.student.full_name),
        studentUsername: a.assessment.student.username,
        assessmentId: a.assessment.id,
        assessmentType: a.assessment.type as 'PROVA' | 'SIMULADO',
        questionText: q.question_text_snapshot,
        selectedOption: selected && OPTION_KEYS.includes(selected as (typeof OPTION_KEYS)[number])
          ? selected
          : selected,
        selectedText: isBlank ? 'Não respondida' : optionText(q, selected),
        correctOption: correct,
        correctText: optionText(q, correct),
        isBlank,
        isCorrect: isBlank ? false : Boolean(a.is_correct),
        answeredAt: a.answered_at?.toISOString() ?? a.assessment.completed_at?.toISOString() ?? null,
        themeName: q.dimension_name_snapshot,
      }
    })

    const summary = {
      total: rows.length,
      correct: rows.filter((r) => !r.isBlank && r.isCorrect).length,
      wrong: rows.filter((r) => !r.isBlank && !r.isCorrect).length,
      blank: rows.filter((r) => r.isBlank).length,
    }

    return NextResponse.json({
      theme: {
        dimensionId,
        name: name || rows[0]?.themeName || 'Tema',
      },
      filters: { type, result },
      summary,
      answers: rows,
      truncated: answers.length >= 500,
    })
  } catch (error: unknown) {
    console.error('Theme details error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao carregar detalhes do tema' },
      { status: err.status || 500 }
    )
  }
}
