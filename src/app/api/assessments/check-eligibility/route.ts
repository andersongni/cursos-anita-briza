import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { getAssessmentSettings, getProvaUnlockState } from '@/lib/settings/assessment'

export async function GET(req: Request) {
  try {
    const { user } = await verifyAuth()
    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') || 'PROVA').toUpperCase()
    const typeKey = type === 'PROVA' ? 'prova' : 'simulado'

    const [inProgress, settings, unlock] = await Promise.all([
      prisma.assessment.findFirst({
        where: {
          student_id: user.id,
          type,
          status: 'IN_PROGRESS',
        },
      }),
      getAssessmentSettings(typeKey),
      type === 'PROVA' ? getProvaUnlockState() : Promise.resolve(null),
    ])

    // Simulado sempre liberado para iniciar; prova só na janela liberada pelo admin.
    // Prova em andamento pode ser continuada mesmo após o fim da janela.
    const provaOpen = type !== 'PROVA' || unlock?.open === true
    const eligible = Boolean(inProgress) || provaOpen

    return NextResponse.json({
      eligible,
      reason:
        eligible || type !== 'PROVA'
          ? null
          : 'A prova oficial está bloqueada. Aguarde a liberação pelo administrador.',
      unlockUntil: unlock?.unlockUntil ?? null,
      remainingMs: unlock?.remainingMs ?? 0,
      unlocked: unlock?.open ?? type !== 'PROVA',
      inProgressId: inProgress?.id ?? null,
      questionCount: settings.questionCount,
      timeLimitMinutes: settings.timeLimitMinutes,
      passingScore: settings.passingScore,
    })
  } catch (error: unknown) {
    console.error('Check eligibility error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao verificar elegibilidade' },
      { status: err.status || 500 }
    )
  }
}
