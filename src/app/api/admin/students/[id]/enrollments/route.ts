import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { ensureCourses, listActiveCourses } from '@/lib/courses'

export const runtime = 'nodejs'

async function listEnrollments(studentId: string) {
  return prisma.courseEnrollment.findMany({
    where: { student_id: studentId },
    select: {
      id: true,
      course_id: true,
      status: true,
      enrolled_at: true,
      course: { select: { id: true, name: true, slug: true } },
    },
    orderBy: { enrolled_at: 'desc' },
  })
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdmin()
    await ensureCourses()
    const { id: studentId } = await params

    const student = await prisma.profile.findFirst({
      where: { id: studentId, role: 'STUDENT' },
      select: { id: true },
    })
    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    const [courses, enrollments] = await Promise.all([
      listActiveCourses(),
      listEnrollments(studentId),
    ])

    return NextResponse.json({ courses, enrollments })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao listar matrículas' },
      { status: err.status || 500 }
    )
  }
}

/**
 * Gerencia matrícula:
 * - action: APPROVE | REJECT | REMOVE | ENROLL
 * - legado: enrolled: boolean (true=ENROLL, false=REMOVE)
 */
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdmin()
    await ensureCourses()
    const { id: studentId } = await params
    const body = await req.json()
    const courseId = typeof body.courseId === 'string' ? body.courseId : ''

    let action: 'APPROVE' | 'REJECT' | 'REMOVE' | 'ENROLL' | null =
      body.action === 'APPROVE' ||
      body.action === 'REJECT' ||
      body.action === 'REMOVE' ||
      body.action === 'ENROLL'
        ? body.action
        : null

    if (!action && typeof body.enrolled === 'boolean') {
      action = body.enrolled ? 'ENROLL' : 'REMOVE'
    }

    if (!courseId || !action) {
      return NextResponse.json(
        { error: 'Informe courseId e action (APPROVE|REJECT|REMOVE|ENROLL)' },
        { status: 400 }
      )
    }

    const student = await prisma.profile.findFirst({
      where: { id: studentId, role: 'STUDENT' },
      select: { id: true },
    })
    if (!student) {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    const course = await prisma.course.findFirst({
      where: { id: courseId, active: true },
      select: { id: true },
    })
    if (!course) {
      return NextResponse.json({ error: 'Curso inválido' }, { status: 400 })
    }

    const nextStatus =
      action === 'APPROVE' || action === 'ENROLL'
        ? 'ACTIVE'
        : action === 'REJECT'
          ? 'REJECTED'
          : 'INACTIVE'

    await prisma.courseEnrollment.upsert({
      where: {
        student_id_course_id: { student_id: studentId, course_id: courseId },
      },
      update: { status: nextStatus },
      create: {
        student_id: studentId,
        course_id: courseId,
        status: nextStatus,
      },
    })

    const enrollments = await listEnrollments(studentId)
    return NextResponse.json({ success: true, enrollments, status: nextStatus })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao atualizar matrícula' },
      { status: err.status || 500 }
    )
  }
}
