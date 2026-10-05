import { prisma } from '@/lib/db'
import {
  PROVA_UNLOCK_UNTIL_KEY,
  provaUnlockUntilKey,
} from '@/lib/settings/assessment-constants'
import { ensureCourses } from '@/lib/courses/ensure-courses'

export {
  PROVA_UNLOCK_UNTIL_KEY,
  PROVA_UNLOCK_WINDOW_HOURS,
  provaUnlockUntilKey,
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

/** Campos da avaliação (prova e simulado compartilham no mesmo curso). */
export const SHARED_ASSESSMENT_SETTING_SUFFIXES = [
  'question_count',
  'time_limit_minutes',
  'passing_score',
] as const

export type AssessmentSettingSuffix =
  (typeof SHARED_ASSESSMENT_SETTING_SUFFIXES)[number]

export function assessmentCourseSettingKey(
  courseId: string,
  suffix: AssessmentSettingSuffix
): string {
  return `assessment.course.${courseId}.${suffix}`
}

/** @deprecated espelho global legado; preferir chaves por curso. */
export function mirroredAssessmentSettingKey(key: string): string | null {
  for (const suffix of SHARED_ASSESSMENT_SETTING_SUFFIXES) {
    if (key === `assessment.prova.${suffix}`) return `assessment.simulado.${suffix}`
    if (key === `assessment.simulado.${suffix}`) return `assessment.prova.${suffix}`
  }
  return null
}

export function isLegacyAssessmentSettingKey(
  key: string
): AssessmentSettingSuffix | null {
  for (const suffix of SHARED_ASSESSMENT_SETTING_SUFFIXES) {
    if (
      key === `assessment.prova.${suffix}` ||
      key === `assessment.simulado.${suffix}`
    ) {
      return suffix
    }
  }
  return null
}

/**
 * Configurações de quantidade, tempo e nota mínima por curso.
 * Prova e simulado do mesmo curso usam os mesmos valores.
 * Se o curso não tiver valor próprio, cai no setting global legado.
 */
export async function getAssessmentSettings(
  _type?: AssessmentTypeKey,
  courseId?: string | null
) {
  void _type
  let cid = courseId ?? null
  if (!cid) {
    const { informaticaId } = await ensureCourses()
    cid = informaticaId
  }

  const [qCount, timeLimit, passing, lq, lt, lp] = await Promise.all([
    prisma.systemSetting.findUnique({
      where: { key: assessmentCourseSettingKey(cid, 'question_count') },
    }),
    prisma.systemSetting.findUnique({
      where: { key: assessmentCourseSettingKey(cid, 'time_limit_minutes') },
    }),
    prisma.systemSetting.findUnique({
      where: { key: assessmentCourseSettingKey(cid, 'passing_score') },
    }),
    prisma.systemSetting.findUnique({ where: { key: 'assessment.prova.question_count' } }),
    prisma.systemSetting.findUnique({
      where: { key: 'assessment.prova.time_limit_minutes' },
    }),
    prisma.systemSetting.findUnique({ where: { key: 'assessment.prova.passing_score' } }),
  ])

  return {
    questionCount: Math.max(
      1,
      Math.floor(parseSettingNumber(qCount?.value ?? lq?.value, 40))
    ),
    timeLimitMinutes: Math.max(
      1,
      Math.floor(parseSettingNumber(timeLimit?.value ?? lt?.value, 120))
    ),
    passingScore: Math.max(
      0,
      Math.min(100, Math.floor(parseSettingNumber(passing?.value ?? lp?.value, 70)))
    ),
  }
}

export type AssessmentSettingsInput = {
  questionCount?: number
  timeLimitMinutes?: number
  passingScore?: number
}

/** Normaliza e grava as 3 configs de avaliação do curso (prova + simulado). */
export async function setAssessmentSettingsForCourse(
  courseId: string,
  input: AssessmentSettingsInput,
  updatedBy?: string | null
) {
  const current = await getAssessmentSettings('prova', courseId)
  const questionCount = Math.max(
    1,
    Math.floor(
      Number.isFinite(Number(input.questionCount))
        ? Number(input.questionCount)
        : current.questionCount
    )
  )
  const timeLimitMinutes = Math.max(
    1,
    Math.floor(
      Number.isFinite(Number(input.timeLimitMinutes))
        ? Number(input.timeLimitMinutes)
        : current.timeLimitMinutes
    )
  )
  const passingScore = Math.max(
    0,
    Math.min(
      100,
      Math.floor(
        Number.isFinite(Number(input.passingScore))
          ? Number(input.passingScore)
          : current.passingScore
      )
    )
  )

  const pairs: { suffix: AssessmentSettingSuffix; value: number }[] = [
    { suffix: 'question_count', value: questionCount },
    { suffix: 'time_limit_minutes', value: timeLimitMinutes },
    { suffix: 'passing_score', value: passingScore },
  ]

  await Promise.all(
    pairs.map(({ suffix, value }) =>
      prisma.systemSetting.upsert({
        where: { key: assessmentCourseSettingKey(courseId, suffix) },
        update: {
          value: JSON.stringify(value),
          ...(updatedBy ? { updated_by: updatedBy } : {}),
        },
        create: {
          key: assessmentCourseSettingKey(courseId, suffix),
          value: JSON.stringify(value),
          updated_by: updatedBy ?? undefined,
          description: `Avaliação do curso (${suffix})`,
        },
      })
    )
  )

  return { questionCount, timeLimitMinutes, passingScore }
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

/** Prova bloqueada por padrão; liberada só até `unlock_until` (ISO), por curso. */
export async function getProvaUnlockState(courseId: string): Promise<ProvaUnlockState> {
  const specific = await prisma.systemSetting.findUnique({
    where: { key: provaUnlockUntilKey(courseId) },
  })
  let unlockUntil = parseUnlockUntil(specific?.value)

  // Legado global só vale para Informática (dados anteriores ao multi-curso)
  if (!unlockUntil) {
    const { informaticaId } = await ensureCourses()
    if (courseId === informaticaId) {
      const legacy = await prisma.systemSetting.findUnique({
        where: { key: PROVA_UNLOCK_UNTIL_KEY },
      })
      unlockUntil = parseUnlockUntil(legacy?.value)
    }
  }

  const now = Date.now()
  const open = unlockUntil != null && unlockUntil.getTime() > now
  return {
    open,
    unlockUntil: unlockUntil?.toISOString() ?? null,
    remainingMs: open && unlockUntil ? Math.max(0, unlockUntil.getTime() - now) : 0,
  }
}
