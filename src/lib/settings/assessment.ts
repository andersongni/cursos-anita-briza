import { prisma } from '@/lib/db'
import { PROVA_UNLOCK_UNTIL_KEY } from '@/lib/settings/assessment-constants'

export {
  PROVA_UNLOCK_UNTIL_KEY,
  PROVA_UNLOCK_WINDOW_HOURS,
} from '@/lib/settings/assessment-constants'

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
  void _type
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

function parseUnlockUntil(raw: string | undefined | null): Date | null {
  if (raw == null || raw === '') return null
  let value: unknown = raw
  try {
    value = JSON.parse(raw)
  } catch {
    // valor bruto
  }
  if (value == null || value === '') return null
  if (typeof value !== 'string' && typeof value !== 'number') return null
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export type ProvaUnlockState = {
  /** Pode iniciar uma nova prova agora */
  open: boolean
  unlockUntil: string | null
  remainingMs: number
}

/** Prova bloqueada por padrão; liberada só até `unlock_until` (ISO). */
export async function getProvaUnlockState(): Promise<ProvaUnlockState> {
  const row = await prisma.systemSetting.findUnique({
    where: { key: PROVA_UNLOCK_UNTIL_KEY },
  })
  const unlockUntil = parseUnlockUntil(row?.value)
  const now = Date.now()
  const open = unlockUntil != null && unlockUntil.getTime() > now
  return {
    open,
    unlockUntil: unlockUntil?.toISOString() ?? null,
    remainingMs: open && unlockUntil ? Math.max(0, unlockUntil.getTime() - now) : 0,
  }
}
