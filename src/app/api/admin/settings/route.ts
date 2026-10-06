import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  assessmentCourseSettingKey,
  getAssessmentSettings,
  isLegacyAssessmentSettingKey,
} from '@/lib/settings/assessment'
import { getCourseById, resolveAdminCourseId } from '@/lib/courses'

export async function GET() {
  try {
    await verifyAdmin()
    const courseId = await resolveAdminCourseId()
    const course = await getCourseById(courseId)
    const courseAssessment = await getAssessmentSettings('prova', courseId)

    const settingsRaw = await prisma.systemSetting.findMany({
      orderBy: { key: 'asc' },
    })

    type SettingRow = {
      id: string
      key: string
      value: unknown
      description: string | null
      updated_at: Date
      updated_by: string | null
    }

    const settings: SettingRow[] = settingsRaw.map((s) => {
      let parsedValue: unknown = s.value
      try {
        parsedValue = JSON.parse(s.value)
      } catch {
        // use raw if unparseable
      }
      return { ...s, value: parsedValue }
    })

    // Expõe valores efetivos do curso ativo nas chaves da UI (assessment.prova.*)
    const overlay: { key: string; value: number }[] = [
      {
        key: 'assessment.prova.question_count',
        value: courseAssessment.questionCount,
      },
      {
        key: 'assessment.prova.time_limit_minutes',
        value: courseAssessment.timeLimitMinutes,
      },
      {
        key: 'assessment.prova.passing_score',
        value: courseAssessment.passingScore,
      },
      {
        key: 'assessment.prova.mc_weight_percent',
        value: courseAssessment.mcWeightPercent,
      },
      {
        key: 'assessment.prova.discursive_weight_percent',
        value: courseAssessment.discursiveWeightPercent,
      },
      {
        key: 'assessment.prova.discursive_count',
        value: courseAssessment.discursiveCount,
      },
    ]

    const byKey = new Map(settings.map((s) => [s.key, s]))
    for (const item of overlay) {
      const existing = byKey.get(item.key)
      if (existing) {
        existing.value = item.value
      } else {
        settings.push({
          id: `virtual-${item.key}`,
          key: item.key,
          value: item.value,
          description: null,
          updated_at: new Date(),
          updated_by: null,
        })
      }
    }

    return NextResponse.json({
      settings,
      courseId,
      courseName: course?.name ?? null,
    })
  } catch (error: unknown) {
    console.error('Error fetching settings:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json()
    const { key, value } = body

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing key or value' }, { status: 400 })
    }

    const courseId =
      (typeof body.courseId === 'string' && body.courseId) ||
      (await resolveAdminCourseId())

    const stringifiedValue = JSON.stringify(value)
    const legacySuffix = isLegacyAssessmentSettingKey(key)

    // Configurações de avaliação → por curso ativo
    const persistKey = legacySuffix
      ? assessmentCourseSettingKey(courseId, legacySuffix)
      : key

    const setting = await prisma.systemSetting.upsert({
      where: { key: persistKey },
      update: { value: stringifiedValue, updated_by: user.id },
      create: {
        key: persistKey,
        value: stringifiedValue,
        updated_by: user.id,
        description: legacySuffix
          ? `Avaliação do curso (${legacySuffix})`
          : undefined,
      },
    })

    return NextResponse.json({
      setting: { ...setting, value, key },
      courseId,
      persistedKey: persistKey,
    })
  } catch (error: unknown) {
    console.error('Error updating setting:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
