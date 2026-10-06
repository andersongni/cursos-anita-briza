import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { getAssessmentSettings, getProvaUnlockState } from '@/lib/settings/assessment'
import {
  getCourseById,
  listStudentCourseIds,
  resolveStudentCourseId,
} from '@/lib/courses'

const NO_ENROLLMENT_MSG =
  'Você não possui matrícula ativa neste curso. Solicite a matrícula e aguarde a aprovação do administrador.'

export async function GET(req: Request) {
  try {
    const { user } = await verifyAuth()
    const { searchParams } = new URL(req.url)
    const type = (searchParams.get('type') || 'PROVA').toUpperCase()
    const typeKey = type === 'PROVA' ? 'prova' : 'simulado'

    const enrolledIds = await listStudentCourseIds(user.id)
    if (enrolledIds.length === 0) {
      const defaults = await getAssessmentSettings(typeKey)
      return NextResponse.json({
        eligible: false,
        enrolled: false,
        courseId: null,
        courseName: null,
        reason: NO_ENROLLMENT_MSG,
        unlockUntil: null,
        remainingMs: 0,
        unlocked: false,
        inProgressId: null,
        questionCount: defaults.questionCount,
        timeLimitMinutes: defaults.timeLimitMinutes,
        passingScore: defaults.passingScore,
      })
    }

    let courseId: string
    try {
      courseId = await resolveStudentCourseId(user.id, searchParams.get('courseId'))
    } catch {
      const defaults = await getAssessmentSettings(typeKey)
      return NextResponse.json({
        eligible: false,
        enrolled: false,
        courseId: null,
        courseName: null,
        reason: NO_ENROLLMENT_MSG,
        unlockUntil: null,
        remainingMs: 0,
        unlocked: false,
        inProgressId: null,
        questionCount: defaults.questionCount,
        timeLimitMinutes: defaults.timeLimitMinutes,
        passingScore: defaults.passingScore,
      })
    }

    const settings = await getAssessmentSettings(typeKey, courseId)

    if (!enrolledIds.includes(courseId)) {
      return NextResponse.json({
        eligible: false,
        enrolled: false,
        courseId,
        courseName: (await getCourseById(courseId))?.name ?? null,
        reason: NO_ENROLLMENT_MSG,
        unlockUntil: null,
        remainingMs: 0,
        unlocked: false,
        inProgressId: null,
        questionCount: settings.questionCount,
        timeLimitMinutes: settings.timeLimitMinutes,
        passingScore: settings.passingScore,
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

    return NextResponse.json({
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
