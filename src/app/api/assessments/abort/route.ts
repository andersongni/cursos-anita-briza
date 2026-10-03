import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'

export async function POST(req: Request) {
  try {
    const { user } = await verifyAuth()
    const body = await req.json()
    const assessment_id = body.assessment_id || body.assessmentId

    if (!assessment_id) {
      return NextResponse.json({ error: 'ID da avaliação não fornecido' }, { status: 400 })
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessment_id },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }

    if (assessment.student_id !== user.id) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 403 })
    }

    if (assessment.status !== 'IN_PROGRESS') {
      return NextResponse.json(
        { error: 'Apenas avaliações em andamento podem ser abortadas' },
        { status: 400 }
      )
    }

    const completedAt = new Date()
    let durationSeconds = 0
    if (assessment.started_at) {
      durationSeconds = Math.floor(
        (completedAt.getTime() - new Date(assessment.started_at).getTime()) / 1000
      )
    }

    const updated = await prisma.assessment.update({
      where: { id: assessment_id },
      data: {
        status: 'CANCELLED',
        completed_at: completedAt,
        duration_seconds: durationSeconds,
        score: null,
        correct_count: null,
        wrong_count: null,
        passed: null,
      },
    })

    return NextResponse.json({
      success: true,
      assessment: {
        id: updated.id,
        type: updated.type,
        status: updated.status,
      },
    })
  } catch (error: any) {
    console.error('Abort assessment error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao abortar avaliação' },
      { status: error.status || 500 }
    )
  }
}
