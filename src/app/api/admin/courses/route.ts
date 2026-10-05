import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  COURSE_COOKIE,
  allocateUniqueCourseSlug,
  courseHasStudentExercises,
  courseHasTypingExercise,
  ensureCourses,
  getCourseById,
  listActiveCourses,
  listCourseFeatures,
  listCoursesForAdmin,
  resolveAdminCourse,
  resolveAdminCourseId,
} from '@/lib/courses'
import {
  getAssessmentSettings,
  setAssessmentSettingsForCourse,
} from '@/lib/settings/assessment'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    await ensureCourses()

    const { searchParams } = new URL(req.url)
    const deleted = searchParams.get('deleted') // only | include | default active
    const manage = searchParams.get('manage') === '1'

    if (manage || deleted) {
      const filter =
        deleted === 'only' || deleted === 'include' ? deleted : null
      const courses = await listCoursesForAdmin(filter)
      const withAssessment = await Promise.all(
        courses.map(async (c) => {
          const assessment = await getAssessmentSettings('prova', c.id)
          return { ...c, assessment }
        })
      )
      return NextResponse.json({ courses: withAssessment })
    }

    const courses = await listActiveCourses()
    const activeCourse = await resolveAdminCourse()
    return NextResponse.json({
      courses,
      activeCourseId: activeCourse.id,
      activeCourse,
      activeCourseHasExercises: courseHasStudentExercises(activeCourse.slug),
      activeCourseHasTypingExercise: courseHasTypingExercise(activeCourse.slug),
      activeCourseFeatures: listCourseFeatures(activeCourse.slug),
    })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao listar cursos' },
      { status: err.status || 500 }
    )
  }
}

/** Define o curso ativo do admin (cookie). */
export async function PUT(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json()
    const courseId = typeof body.courseId === 'string' ? body.courseId : ''
    const resolved = await resolveAdminCourseId(courseId)
    const jar = await cookies()
    jar.set(COURSE_COOKIE, resolved, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365,
    })
    return NextResponse.json({ success: true, activeCourseId: resolved })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao selecionar curso' },
      { status: err.status || 500 }
    )
  }
}

function parseAssessmentFields(body: Record<string, unknown>) {
  const questionCount = Number(body.questionCount ?? body.question_count)
  const timeLimitMinutes = Number(
    body.timeLimitMinutes ?? body.time_limit_minutes
  )
  const passingScore = Number(body.passingScore ?? body.passing_score)
  return {
    questionCount: Number.isFinite(questionCount) ? questionCount : undefined,
    timeLimitMinutes: Number.isFinite(timeLimitMinutes)
      ? timeLimitMinutes
      : undefined,
    passingScore: Number.isFinite(passingScore) ? passingScore : undefined,
  }
}

/** Cria um novo curso. */
export async function POST(req: Request) {
  try {
    const { user } = await verifyAdmin()
    await ensureCourses()
    const body = await req.json()

    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (!name || name.length < 3) {
      return NextResponse.json(
        { error: 'Informe um nome com pelo menos 3 caracteres' },
        { status: 400 }
      )
    }

    const description =
      typeof body.description === 'string' ? body.description.trim() || null : null
    const hoursRaw = Number(body.hours)
    const hours =
      Number.isFinite(hoursRaw) && hoursRaw > 0 ? Math.floor(hoursRaw) : 40

    const assessment = parseAssessmentFields(body)
    if (
      assessment.questionCount == null ||
      assessment.timeLimitMinutes == null ||
      assessment.passingScore == null
    ) {
      return NextResponse.json(
        {
          error:
            'Informe quantidade de perguntas, tempo limite e nota mínima da avaliação',
        },
        { status: 400 }
      )
    }

    const slug =
      typeof body.slug === 'string' && body.slug.trim()
        ? await allocateUniqueCourseSlug(body.slug.trim())
        : await allocateUniqueCourseSlug(name)

    const course = await prisma.course.create({
      data: {
        name,
        slug,
        description,
        hours,
        active: true,
      },
    })

    const assessmentSettings = await setAssessmentSettingsForCourse(
      course.id,
      assessment,
      user.id
    )

    return NextResponse.json({ course, assessmentSettings }, { status: 201 })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number; code?: string }
    if (err.code === 'P2002') {
      return NextResponse.json(
        { error: 'Já existe um curso com esse identificador' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: err.message || 'Erro ao criar curso' },
      { status: err.status || 500 }
    )
  }
}

/**
 * Soft-delete / restaurar / atualizar curso.
 * Exclusão lógica: active = false (restaurável), como alunos com deleted_at.
 */
export async function PATCH(req: Request) {
  try {
    const { user } = await verifyAdmin()
    await ensureCourses()
    const body = await req.json()
    const id = typeof body.id === 'string' ? body.id : ''
    if (!id) {
      return NextResponse.json({ error: 'ID do curso é obrigatório' }, { status: 400 })
    }

    const existing = await getCourseById(id, { includeInactive: true })
    if (!existing) {
      return NextResponse.json({ error: 'Curso não encontrado' }, { status: 404 })
    }

    const action =
      typeof body.action === 'string' ? body.action.toUpperCase() : ''

    if (action === 'DELETE') {
      if (!existing.active) {
        return NextResponse.json(
          { error: 'Curso já está excluído' },
          { status: 400 }
        )
      }

      const activeCount = await prisma.course.count({ where: { active: true } })
      if (activeCount <= 1) {
        return NextResponse.json(
          { error: 'Não é possível excluir o único curso ativo' },
          { status: 400 }
        )
      }

      const course = await prisma.course.update({
        where: { id },
        data: { active: false },
      })

      // Se era o curso selecionado no admin, aponta para outro ativo
      try {
        const jar = await cookies()
        const current = jar.get(COURSE_COOKIE)?.value
        if (current === id) {
          const next = await resolveAdminCourseId()
          jar.set(COURSE_COOKIE, next, {
            path: '/',
            httpOnly: false,
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 365,
          })
        }
      } catch {
        // ignore cookie errors
      }

      return NextResponse.json({ course, action: 'DELETE' })
    }

    if (action === 'RESTORE') {
      if (existing.active) {
        return NextResponse.json(
          { error: 'Curso já está ativo' },
          { status: 400 }
        )
      }
      const course = await prisma.course.update({
        where: { id },
        data: { active: true },
      })
      return NextResponse.json({ course, action: 'RESTORE' })
    }

    // Atualização de dados
    const data: {
      name?: string
      description?: string | null
      hours?: number
    } = {}

    if (typeof body.name === 'string') {
      const name = body.name.trim()
      if (name.length < 3) {
        return NextResponse.json(
          { error: 'Informe um nome com pelo menos 3 caracteres' },
          { status: 400 }
        )
      }
      data.name = name
    }
    if (body.description !== undefined) {
      data.description =
        typeof body.description === 'string'
          ? body.description.trim() || null
          : null
    }
    if (body.hours !== undefined) {
      const hours = Number(body.hours)
      if (!Number.isFinite(hours) || hours <= 0) {
        return NextResponse.json({ error: 'Carga horária inválida' }, { status: 400 })
      }
      data.hours = Math.floor(hours)
    }

    const assessmentInput = parseAssessmentFields(body)
    const hasAssessmentUpdate =
      assessmentInput.questionCount != null ||
      assessmentInput.timeLimitMinutes != null ||
      assessmentInput.passingScore != null

    if (Object.keys(data).length === 0 && !hasAssessmentUpdate) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 })
    }

    const course =
      Object.keys(data).length > 0
        ? await prisma.course.update({ where: { id }, data })
        : existing

    const assessmentSettings = hasAssessmentUpdate
      ? await setAssessmentSettingsForCourse(id, assessmentInput, user.id)
      : await getAssessmentSettings('prova', id)

    return NextResponse.json({ course, assessmentSettings, action: 'UPDATE' })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao atualizar curso' },
      { status: err.status || 500 }
    )
  }
}
