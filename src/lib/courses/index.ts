import { cookies } from 'next/headers'
import { prisma } from '@/lib/db'
import {
  COURSE_COOKIE,
  INFORMATICA_COURSE_SLUG,
  STUDENT_COURSE_COOKIE,
} from '@/lib/courses/constants'
import { courseHasTypingExercise } from '@/lib/courses/capabilities'
import { ensureCourses } from '@/lib/courses/ensure-courses'

export {
  COURSE_COOKIE,
  STUDENT_COURSE_COOKIE,
  INFORMATICA_COURSE_SLUG,
  DEFAULT_COURSES,
} from '@/lib/courses/constants'
export {
  COURSE_FEATURES,
  EXERCISE_FEATURE_IDS,
  courseHasFeature,
  courseHasStudentExercises,
  courseHasTypingExercise,
  listCourseFeatures,
  type CourseFeatureId,
} from '@/lib/courses/capabilities'
export { ensureCourses } from '@/lib/courses/ensure-courses'

export type CourseSummary = {
  id: string
  slug: string
  name: string
  description: string | null
  hours: number
  active: boolean
}

const courseSelect = {
  id: true,
  slug: true,
  name: true,
  description: true,
  hours: true,
  active: true,
} as const

/** Gera slug URL-safe a partir do nome. */
export function slugifyCourseName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
}

export async function listActiveCourses(): Promise<CourseSummary[]> {
  await ensureCourses()
  return prisma.course.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: courseSelect,
  })
}

/**
 * Lista cursos para gestão admin.
 * `deleted`: default ativos; `only` = excluídos; `include` = todos.
 */
export async function listCoursesForAdmin(
  deleted?: 'only' | 'include' | null
): Promise<CourseSummary[]> {
  await ensureCourses()
  const where =
    deleted === 'only'
      ? { active: false }
      : deleted === 'include'
        ? {}
        : { active: true }

  return prisma.course.findMany({
    where,
    orderBy: [{ active: 'desc' }, { name: 'asc' }],
    select: courseSelect,
  })
}

export async function getCourseById(
  id: string,
  opts?: { includeInactive?: boolean }
): Promise<CourseSummary | null> {
  await ensureCourses()
  return prisma.course.findFirst({
    where: opts?.includeInactive ? { id } : { id, active: true },
    select: courseSelect,
  })
}

export async function getDefaultCourse(): Promise<CourseSummary> {
  const { informaticaId } = await ensureCourses()
  const preferred = await getCourseById(informaticaId)
  if (preferred) return preferred

  const anyActive = await prisma.course.findFirst({
    where: { active: true },
    orderBy: { name: 'asc' },
    select: courseSelect,
  })
  if (!anyActive) {
    throw new Error('Nenhum curso ativo disponível')
  }
  return anyActive
}

/** Garante slug único (incluindo cursos excluídos logicamente). */
export async function allocateUniqueCourseSlug(baseName: string): Promise<string> {
  const base = slugifyCourseName(baseName) || 'curso'
  let candidate = base
  let n = 2
  while (true) {
    const existing = await prisma.course.findUnique({
      where: { slug: candidate },
      select: { id: true },
    })
    if (!existing) return candidate
    candidate = `${base}-${n}`
    n += 1
    if (n > 100) {
      candidate = `${base}-${Date.now().toString(36)}`
      break
    }
  }
  return candidate
}

/** Curso ativo do admin (cookie) ou padrão Informática. */
export async function resolveAdminCourseId(
  explicitId?: string | null
): Promise<string> {
  const course = await resolveAdminCourse(explicitId)
  return course.id
}

/** Curso ativo do admin com slug/nome (para gates de feature). */
export async function resolveAdminCourse(
  explicitId?: string | null
): Promise<CourseSummary> {
  await ensureCourses()
  if (explicitId) {
    const found = await getCourseById(explicitId)
    if (found) return found
  }

  try {
    const jar = await cookies()
    const fromCookie = jar.get(COURSE_COOKIE)?.value
    if (fromCookie) {
      const found = await getCourseById(fromCookie)
      if (found) return found
    }
  } catch {
    // fora de request (scripts)
  }

  return getDefaultCourse()
}

export async function listStudentCourseIds(studentId: string): Promise<string[]> {
  await ensureCourses()
  const rows = await prisma.courseEnrollment.findMany({
    where: { student_id: studentId, status: 'ACTIVE', course: { active: true } },
    select: { course_id: true },
  })
  return rows.map((r) => r.course_id)
}

export async function listStudentCourses(studentId: string): Promise<CourseSummary[]> {
  await ensureCourses()
  return prisma.course.findMany({
    where: {
      active: true,
      enrollments: { some: { student_id: studentId, status: 'ACTIVE' } },
    },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      hours: true,
      active: true,
    },
  })
}

export async function assertStudentEnrolled(
  studentId: string,
  courseId: string
): Promise<void> {
  const enrollment = await prisma.courseEnrollment.findUnique({
    where: {
      student_id_course_id: { student_id: studentId, course_id: courseId },
    },
  })
  if (!enrollment || enrollment.status !== 'ACTIVE') {
    const err = new Error('Aluno não matriculado neste curso') as Error & {
      status?: number
    }
    err.status = 403
    throw err
  }
}

export async function isStudentEnrolledInCourseSlug(
  studentId: string,
  slug: string
): Promise<boolean> {
  await ensureCourses()
  const row = await prisma.courseEnrollment.findFirst({
    where: {
      student_id: studentId,
      status: 'ACTIVE',
      course: { slug, active: true },
    },
    select: { id: true },
  })
  return Boolean(row)
}

/** Digitção pertence à Informática Básica — só alunos matriculados nesse curso. */
export async function assertTypingExerciseAccess(studentId: string): Promise<void> {
  const ok = await isStudentEnrolledInCourseSlug(studentId, INFORMATICA_COURSE_SLUG)
  if (!ok) {
    const err = new Error(
      'O exercício de digitação está disponível apenas para alunos matriculados em Informática Básica.'
    ) as Error & { status?: number }
    err.status = 403
    throw err
  }
}

/** Admin só gerencia digitação com o curso Informática ativo. */
export async function assertAdminTypingExerciseAccess(): Promise<void> {
  const course = await resolveAdminCourse()
  if (!courseHasTypingExercise(course.slug)) {
    const err = new Error(
      `A prática de digitação não está disponível para o curso ${course.name}. Troque o curso ativo para Informática Básica.`
    ) as Error & { status?: number }
    err.status = 403
    throw err
  }
}

/**
 * Devolve o curso ativo do aluno (cookie / explicit) entre matrículas ACTIVE.
 * Não cria matrícula automaticamente.
 */
export async function resolveStudentCourseId(
  studentId: string,
  explicitId?: string | null
): Promise<string> {
  await ensureCourses()
  const enrolled = await listStudentCourseIds(studentId)

  if (enrolled.length === 0) {
    const err = new Error(
      'Você não possui matrícula ativa em nenhum curso. Solicite a matrícula e aguarde a aprovação do administrador.'
    ) as Error & { status?: number }
    err.status = 403
    throw err
  }

  if (explicitId && enrolled.includes(explicitId)) return explicitId

  try {
    const jar = await cookies()
    const fromCookie = jar.get(STUDENT_COURSE_COOKIE)?.value
    if (fromCookie && enrolled.includes(fromCookie)) return fromCookie
  } catch {
    // fora de request
  }

  return enrolled[0]
}

export async function requestCourseEnrollment(
  studentId: string,
  courseId: string
): Promise<{ status: string; created: boolean }> {
  await ensureCourses()
  const course = await prisma.course.findFirst({
    where: { id: courseId, active: true },
    select: { id: true },
  })
  if (!course) {
    const err = new Error('Curso inválido') as Error & { status?: number }
    err.status = 400
    throw err
  }

  const existing = await prisma.courseEnrollment.findUnique({
    where: {
      student_id_course_id: { student_id: studentId, course_id: courseId },
    },
  })

  if (existing?.status === 'ACTIVE') {
    return { status: 'ACTIVE', created: false }
  }
  if (existing?.status === 'PENDING') {
    return { status: 'PENDING', created: false }
  }

  if (existing) {
    await prisma.courseEnrollment.update({
      where: { id: existing.id },
      data: { status: 'PENDING' },
    })
    return { status: 'PENDING', created: false }
  }

  await prisma.courseEnrollment.create({
    data: {
      student_id: studentId,
      course_id: courseId,
      status: 'PENDING',
    },
  })
  return { status: 'PENDING', created: true }
}

export async function setStudentCourseCookie(courseId: string): Promise<void> {
  const jar = await cookies()
  jar.set(STUDENT_COURSE_COOKIE, courseId, {
    path: '/',
    httpOnly: false,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  })
}
