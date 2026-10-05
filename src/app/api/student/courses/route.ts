import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import {
  courseHasStudentExercises,
  ensureCourses,
  listActiveCourses,
  listStudentCourses,
  requestCourseEnrollment,
  resolveStudentCourseId,
  setStudentCourseCookie,
} from '@/lib/courses'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const { user, profile } = await verifyAuth()
    await ensureCourses()

    if (profile.role === 'ADMIN') {
      const courses = await listActiveCourses()
      return NextResponse.json({
        courses,
        active: courses,
        pending: [],
        available: [],
        activeCourseId: courses[0]?.id ?? null,
      })
    }

    const [allCourses, active, enrollments] = await Promise.all([
      listActiveCourses(),
      listStudentCourses(user.id),
      prisma.courseEnrollment.findMany({
        where: { student_id: user.id },
        select: {
          id: true,
          course_id: true,
          status: true,
          enrolled_at: true,
          course: {
            select: {
              id: true,
              slug: true,
              name: true,
              description: true,
              hours: true,
              active: true,
            },
          },
        },
      }),
    ])

    const pending = enrollments
      .filter((e) => e.status === 'PENDING')
      .map((e) => e.course)

    const enrolledOrPendingIds = new Set(
      enrollments
        .filter((e) => e.status === 'ACTIVE' || e.status === 'PENDING')
        .map((e) => e.course_id)
    )

    const available = allCourses.filter((c) => !enrolledOrPendingIds.has(c.id))

    let activeCourseId: string | null = null
    if (active.length > 0) {
      try {
        activeCourseId = await resolveStudentCourseId(user.id)
      } catch {
        activeCourseId = active[0]?.id ?? null
      }
    }

    const activeCourse =
      active.find((c) => c.id === activeCourseId) ?? active[0] ?? null
    const activeCourseHasExercises = courseHasStudentExercises(activeCourse?.slug)

    return NextResponse.json({
      courses: active,
      active,
      pending,
      available,
      enrollments,
      activeCourseId,
      activeCourse,
      activeCourseHasExercises,
    })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao listar cursos do aluno' },
      { status: err.status || 500 }
    )
  }
}

/** Solicita matrícula em um curso (fica PENDING até o admin aprovar). */
export async function POST(req: Request) {
  try {
    const { user, profile } = await verifyAuth()
    if (profile.role === 'ADMIN') {
      return NextResponse.json({ error: 'Admins não solicitam matrícula' }, { status: 400 })
    }
    if (profile.status === 'BLOCKED') {
      return NextResponse.json({ error: 'Conta bloqueada' }, { status: 403 })
    }

    const body = await req.json()
    const courseId = typeof body.courseId === 'string' ? body.courseId : ''
    if (!courseId) {
      return NextResponse.json({ error: 'Informe o curso' }, { status: 400 })
    }

    const result = await requestCourseEnrollment(user.id, courseId)

    if (result.status === 'ACTIVE') {
      return NextResponse.json({
        success: true,
        status: 'ACTIVE',
        message: 'Você já está matriculado neste curso.',
      })
    }

    return NextResponse.json({
      success: true,
      status: 'PENDING',
      message: result.created
        ? 'Solicitação enviada. Aguarde a aprovação do administrador.'
        : 'Solicitação já registrada. Aguarde a aprovação do administrador.',
    })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao solicitar matrícula' },
      { status: err.status || 500 }
    )
  }
}

/** Define o curso ativo do aluno (cookie) — só entre matrículas ACTIVE. */
export async function PUT(req: Request) {
  try {
    const { user, profile } = await verifyAuth()
    if (profile.role === 'ADMIN') {
      return NextResponse.json({ error: 'Use /api/admin/courses' }, { status: 400 })
    }
    const body = await req.json()
    const courseId = typeof body.courseId === 'string' ? body.courseId : ''
    const resolved = await resolveStudentCourseId(user.id, courseId)
    await setStudentCourseCookie(resolved)
    return NextResponse.json({ success: true, activeCourseId: resolved })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao selecionar curso' },
      { status: err.status || 500 }
    )
  }
}
