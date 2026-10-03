import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { getAssessmentSettings } from '@/lib/settings/assessment'

/** Sem bloqueio de intervalo: sempre elegível (exceto se já houver uma em andamento). */
export async function GET(req: Request) {
  try {
    const { user } = await verifyAuth()
    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') || 'PROVA').toUpperCase()
    const typeKey = type === 'PROVA' ? 'prova' : 'simulado'

    const [inProgress, settings] = await Promise.all([
      prisma.assessment.findFirst({
        where: {
          student_id: user.id,
          type,
          status: 'IN_PROGRESS',
        },
      }),
      getAssessmentSettings(typeKey),
    ])

    return NextResponse.json({
      eligible: true,
      inProgressId: inProgress?.id ?? null,
      questionCount: settings.questionCount,
      timeLimitMinutes: settings.timeLimitMinutes,
      passingScore: settings.passingScore,
    })
  } catch (error: any) {
    console.error('Check eligibility error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao verificar elegibilidade' },
      { status: error.status || 500 }
    )
  }
}
