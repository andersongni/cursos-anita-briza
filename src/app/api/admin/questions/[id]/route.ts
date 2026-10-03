import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin()
    const { id } = await params

    const question = await prisma.question.findUnique({
      where: { id },
      include: { options: true, dimension: true }
    })

    if (!question) {
      return NextResponse.json({ error: 'Question not found' }, { status: 404 })
    }

    return NextResponse.json({ question })
  } catch (error: any) {
    console.error('Error fetching question:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin()
    const { id } = await params
    const body = await req.json()
    const { type, dimension_id, question_text, active, options } = body

    const updateData: any = {}
    if (type !== undefined) updateData.type = type
    if (dimension_id !== undefined) updateData.dimension_id = dimension_id
    if (question_text !== undefined) updateData.question_text = question_text
    if (active !== undefined) updateData.active = active

    if (options && Array.isArray(options)) {
      if (options.length !== 5 || options.filter(o => o.is_correct).length !== 1) {
         return NextResponse.json({ error: 'Exactly 5 options required with 1 correct' }, { status: 400 })
      }
      
      const updatedQuestion = await prisma.$transaction(async (tx) => {
        await tx.questionOption.deleteMany({ where: { question_id: id } })
        return tx.question.update({
          where: { id },
          data: {
            ...updateData,
            options: { create: options }
          },
          include: { options: true }
        })
      })
      return NextResponse.json({ question: updatedQuestion })
    } else {
      const updatedQuestion = await prisma.question.update({
        where: { id },
        data: updateData,
        include: { options: true }
      })
      return NextResponse.json({ question: updatedQuestion })
    }
  } catch (error: any) {
    console.error('Error updating question:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin()
    const { id } = await params

    const usageCount = await prisma.assessmentQuestion.count({
      where: { question_id: id }
    })

    if (usageCount > 0) {
      await prisma.question.update({
        where: { id },
        data: { active: false }
      })
      return NextResponse.json({ success: true, message: 'Question deactivated due to being used in assessments' })
    } else {
      await prisma.question.delete({
        where: { id }
      })
      return NextResponse.json({ success: true, message: 'Question deleted' })
    }
  } catch (error: any) {
    console.error('Error deleting question:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}
