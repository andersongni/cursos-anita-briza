import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdmin()
    const { id } = await params

    const question = await prisma.question.findUnique({
      where: { id },
      include: { options: true, dimension: true },
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    return NextResponse.json({ question })
  } catch (error: unknown) {
    console.error('Error fetching question:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdmin()
    const { id } = await params
    const body = await req.json()
    const {
      type,
      dimension_id,
      question_text,
      active,
      options,
      format: rawFormat,
      expected_answer,
    } = body

    const existing = await prisma.question.findUnique({ where: { id } })
    if (!existing) {
      return NextResponse.json({ error: 'Pergunta não encontrada' }, { status: 404 })
    }

    const format =
      rawFormat === 'DISCURSIVE' || rawFormat === 'MULTIPLE_CHOICE'
        ? rawFormat
        : existing.format || 'MULTIPLE_CHOICE'

    const updateData: {
      type?: string
      dimension_id?: string
      question_text?: string
      active?: boolean
      format?: string
      expected_answer?: string | null
    } = {}
    if (type !== undefined) updateData.type = type
    if (dimension_id !== undefined) updateData.dimension_id = dimension_id
    if (question_text !== undefined) updateData.question_text = question_text
    if (active !== undefined) updateData.active = active
    updateData.format = format

    if (format === 'DISCURSIVE') {
      const expected =
        expected_answer !== undefined
          ? String(expected_answer).trim()
          : existing.expected_answer?.trim() || ''
      if (!expected) {
        return NextResponse.json(
          { error: 'Informe os critérios ou exemplos aceitos para a discursiva' },
          { status: 400 }
        )
      }
      updateData.expected_answer = expected

      const updatedQuestion = await prisma.$transaction(async (tx) => {
        await tx.questionOption.deleteMany({ where: { question_id: id } })
        return tx.question.update({
          where: { id },
          data: updateData,
          include: { options: true },
        })
      })
      return NextResponse.json({ question: updatedQuestion })
    }

    updateData.expected_answer = null

    if (options && Array.isArray(options)) {
      if (
        options.length !== 5 ||
        options.filter((o: { is_correct?: boolean }) => o.is_correct).length !== 1
      ) {
        return NextResponse.json(
          { error: 'Exactly 5 options required with 1 correct' },
          { status: 400 }
        )
      }

      const updatedQuestion = await prisma.$transaction(async (tx) => {
        await tx.questionOption.deleteMany({ where: { question_id: id } })
        return tx.question.update({
          where: { id },
          data: {
            ...updateData,
            options: { create: options },
          },
          include: { options: true },
        })
      })
      return NextResponse.json({ question: updatedQuestion })
    }

    const updatedQuestion = await prisma.question.update({
      where: { id },
      data: updateData,
      include: { options: true },
    })
    return NextResponse.json({ question: updatedQuestion })
  } catch (error: unknown) {
    console.error('Error updating question:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdmin()
    const { id } = await params

    const usageCount = await prisma.assessmentQuestion.count({
      where: { question_id: id },
    })

    if (usageCount > 0) {
      await prisma.question.update({
        where: { id },
        data: { active: false },
      })
      return NextResponse.json({
        success: true,
        message: 'Question deactivated due to being used in assessments',
      })
    }

    await prisma.question.delete({ where: { id } })
    return NextResponse.json({ success: true, message: 'Question deleted' })
  } catch (error: unknown) {
    console.error('Error deleting question:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
