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

/** Campos compartilhados entre prova e simulado (canônico = assessment.prova.*). */
export const SHARED_ASSESSMENT_SETTING_SUFFIXES = [
  'question_count',
  'time_limit_minutes',
  'passing_score',
] as const

export function mirroredAssessmentSettingKey(key: string): string | null {
  for (const suffix of SHARED_ASSESSMENT_SETTING_SUFFIXES) {
    if (key === `assessment.prova.${suffix}`) return `assessment.simulado.${suffix}`
    if (key === `assessment.simulado.${suffix}`) return `assessment.prova.${suffix}`
  }
  return null
}

/**
 * Configurações de quantidade, tempo e nota mínima.
 * Prova e simulado compartilham os mesmos valores (lidos de assessment.prova.*).
 */
export async function getAssessmentSettings(_type?: AssessmentTypeKey) {
  const prefix = 'assessment.prova'
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
