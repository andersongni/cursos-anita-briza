import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { getAssessmentSettings, getProvaUnlockState } from '@/lib/settings/assessment'
import {
  getCourseById,
  listStudentCourseIds,
  resolveStudentCourseId,
} from '@/lib/courses'

export const dynamic = 'force-dynamic'

const NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
  Pragma: 'no-cache',
}

const NO_ENROLLMENT_MSG =
  'Você não possui matrícula ativa neste curso. Solicite a matrícula e aguarde a aprovação do administrador.'

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE_HEADERS })
}

function compositionFromSettings(settings: {
  questionCount: number
  discursiveCount: number
  mcWeightPercent: number
  discursiveWeightPercent: number
  timeLimitMinutes: number
  passingScore: number
}) {
  const mcCount = settings.questionCount
  const discursiveCount = settings.discursiveCount
  return {
    questionCount: mcCount + discursiveCount,
    mcCount,
    discursiveCount,
    mcWeightPercent: settings.mcWeightPercent,
    discursiveWeightPercent: settings.discursiveWeightPercent,
    timeLimitMinutes: settings.timeLimitMinutes,
    passingScore: settings.passingScore,
  }
}

export async function GET(req: Request) {
  try {
    const { user } = await verifyAuth()
    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') || 'PROVA').toUpperCase()
    const typeKey = type === 'PROVA' ? 'prova' : 'simulado'

    const enrolledIds = await listStudentCourseIds(user.id)
    if (enrolledIds.length === 0) {
      const defaults = await getAssessmentSettings(typeKey)
      return json({
        eligible: false,
        enrolled: false,
        courseId: null,
        courseName: null,
        reason: NO_ENROLLMENT_MSG,
        unlockUntil: null,
        remainingMs: 0,
        unlocked: false,
        inProgressId: null,
        ...compositionFromSettings(defaults),
      })
    }

    let courseId: string
    try {
      courseId = await resolveStudentCourseId(user.id, searchParams.get('courseId'))
    } catch (err: unknown) {
      const status = (err as { status?: number } | null)?.status
      if (status === 403) {
        const defaults = await getAssessmentSettings(typeKey)
        return json({
          eligible: false,
          enrolled: false,
          courseId: null,
          courseName: null,
          reason: NO_ENROLLMENT_MSG,
          unlockUntil: null,
          remainingMs: 0,
          unlocked: false,
          inProgressId: null,
          ...compositionFromSettings(defaults),
        })
      }
      throw err
    }

    const settings = await getAssessmentSettings(typeKey, courseId)

    if (!enrolledIds.includes(courseId)) {
      return json({
        eligible: false,
        enrolled: false,
        courseId,
        courseName: (await getCourseById(courseId))?.name ?? null,
        reason: NO_ENROLLMENT_MSG,
        unlockUntil: null,
        remainingMs: 0,
        unlocked: false,
        inProgressId: null,
        ...compositionFromSettings(settings),
      })
    }

    const course = await getCourseById(courseId)

    const [inProgress, awaitingGrading, unlock] = await Promise.all([
      prisma.assessment.findFirst({
        where: {
          student_id: user.id,
          course_id: courseId,
          type,
          status: 'IN_PROGRESS',
        },
      }),
      prisma.assessment.findFirst({
        where: {
          student_id: user.id,
          course_id: courseId,
          type,
          status: 'AWAITING_GRADING',
        },
        orderBy: { completed_at: 'desc' },
      }),
      type === 'PROVA' ? getProvaUnlockState(courseId) : Promise.resolve(null),
    ])

    // Simulado liberado se matriculado; prova só na janela do admin.
    // Prova em andamento pode ser continuada mesmo após o fim da janela.
    // Com discursivas aguardando correção, não inicia nova tentativa.
    const provaOpen = type !== 'PROVA' || unlock?.open === true
    const eligible =
      Boolean(inProgress) || (provaOpen && !awaitingGrading)

    let reason: string | null = null
    if (awaitingGrading && !inProgress) {
      reason =
        'Sua avaliação foi enviada e aguarda correção das questões discursivas pelo administrador.'
    } else if (!eligible && type === 'PROVA') {
      reason =
        'A prova oficial está bloqueada. Aguarde a liberação pelo administrador.'
    }

    return json({
      eligible,
      enrolled: true,
      courseId,
      courseName: course?.name ?? null,
      reason,
      unlockUntil: unlock?.unlockUntil ?? null,
      remainingMs: unlock?.remainingMs ?? 0,
      unlocked: unlock?.open ?? type !== 'PROVA',
      inProgressId: inProgress?.id ?? null,
      awaitingGradingId: awaitingGrading?.id ?? null,
      ...compositionFromSettings(settings),
    })
  } catch (error: unknown) {
    console.error('Check eligibility error:', error)
    const err = error as { message?: string; status?: number }
    return json(
      { error: err.message || 'Erro ao verificar elegibilidade' },
      err.status || 500
    )
  }
}
