import { prisma } from '@/lib/db'

export function parseSettingNumber(raw: string | undefined | null, fallback: number): number {
  if (raw == null || raw === '') return fallback
  try {
    const parsed = JSON.parse(raw)
    const n = Number(parsed)
    return Number.isFinite(n) ? n : fallback
  } catch {
    const n = Number(raw)
    return Number.isFinite(n) ? n : fallback
  }
}

export type AssessmentTypeKey = 'prova' | 'simulado'

export async function getAssessmentSettings(type: AssessmentTypeKey) {
  const prefix = `assessment.${type}`
  const [qCount, timeLimit, passing] = await Promise.all([
    prisma.systemSetting.findUnique({ where: { key: `${prefix}.question_count` } }),
    prisma.systemSetting.findUnique({ where: { key: `${prefix}.time_limit_minutes` } }),
    prisma.systemSetting.findUnique({ where: { key: `${prefix}.passing_score` } }),
  ])

  return {
    questionCount: Math.max(1, Math.floor(parseSettingNumber(qCount?.value, 40))),
    timeLimitMinutes: Math.max(1, Math.floor(parseSettingNumber(timeLimit?.value, 120))),
    passingScore: Math.max(0, Math.min(100, Math.floor(parseSettingNumber(passing?.value, 70)))),
  }
}
