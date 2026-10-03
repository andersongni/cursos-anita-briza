import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'

function parseSettingNumber(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  try {
    const parsed = JSON.parse(raw)
    const n = Number(parsed)
    return Number.isFinite(n) ? n : fallback
  } catch {
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  }
}

/** Sem bloqueio de intervalo: sempre elegível (exceto se já houver uma em andamento). */
export async function GET(req: Request) {
  try {
    const { user } = await verifyAuth()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type') || 'PROVA'
    const typeKey = type.toLowerCase() === 'prova' ? 'prova' : 'simulado'

    const [inProgress, qCountSetting, timeSetting, passSetting] = await Promise.all([
      prisma.assessment.findFirst({
        where: {
          student_id: user.id,
          type,
          status: 'IN_PROGRESS',
        },
      }),
      prisma.systemSetting.findUnique({
        where: { key: `assessment.${typeKey}.question_count` },
      }),
      prisma.systemSetting.findUnique({
        where: { key: `assessment.${typeKey}.time_limit_minutes` },
      }),
      prisma.systemSetting.findUnique({
        where: { key: `assessment.${typeKey}.passing_score` },
      }),
    ])

    const questionCount = Math.max(1, Math.floor(parseSettingNumber(qCountSetting?.value, 40)))
    const timeLimitMinutes = Math.max(1, Math.floor(parseSettingNumber(timeSetting?.value, 120)))
    const passingScore = Math.max(0, Math.floor(parseSettingNumber(passSetting?.value, 70)))

    if (inProgress) {
      return NextResponse.json({
        eligible: true,
        inProgressId: inProgress.id,
        questionCount,
        timeLimitMinutes,
        passingScore,
      })
    }

    return NextResponse.json({
      eligible: true,
      questionCount,
      timeLimitMinutes,
      passingScore,
    })
  } catch (error: any) {
    console.error('Check eligibility error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao verificar elegibilidade' },
      { status: error.status || 500 }
    )
  }
}
