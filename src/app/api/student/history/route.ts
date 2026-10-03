import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'

export async function GET() {
  try {
    const { user } = await verifyAuth()

    const assessments = await prisma.assessment.findMany({
      where: { student_id: user.id },
      orderBy: { started_at: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        score: true,
        passed: true,
        started_at: true,
        completed_at: true,
        duration_seconds: true,
        attempt_number: true,
      },
    })

    return NextResponse.json({
      assessments: assessments.map((a) => ({
        id: a.id,
        type: a.type,
        status: a.status,
        score: a.score,
        passed: a.passed,
        createdAt: a.started_at,
        duration: a.duration_seconds,
        attemptNumber: a.attempt_number,
      })),
    })
  } catch (error: any) {
    console.error('Student history error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao buscar histórico' },
      { status: error.status || 500 }
    )
  }
}
