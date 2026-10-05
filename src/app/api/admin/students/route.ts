import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { notDeleted } from '@/lib/students/soft-delete'
import { getCourseById, resolveAdminCourseId } from '@/lib/courses'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const deleted = searchParams.get('deleted') // 'only' | 'include' | default active only
    /** ACTIVE (padrão) | PENDING | ANY — matrícula no curso ativo */
    const enrollment = (searchParams.get('enrollment') || 'ACTIVE').toUpperCase()
    const courseId =
      searchParams.get('courseId') || (await resolveAdminCourseId())
    const course = await getCourseById(courseId, { includeInactive: true })

    const enrollmentWhere =
      enrollment === 'PENDING'
        ? { course_id: courseId, status: 'PENDING' }
        : enrollment === 'ANY'
          ? { course_id: courseId, status: { in: ['PENDING', 'ACTIVE'] } }
          : { course_id: courseId, status: 'ACTIVE' }

    const where: Record<string, unknown> = {
      role: 'STUDENT',
      enrollments: { some: enrollmentWhere },
    }
    if (deleted === 'only') {
      where.deleted_at = { not: null }
    } else if (deleted !== 'include') {
      Object.assign(where, notDeleted)
    }
    if (status) {
      where.status = status
    }

    const profiles = await prisma.profile.findMany({
      where,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        status: true,
        deleted_at: true,
        created_at: true,
        last_login_at: true,
        enrollments: {
          where: { course_id: courseId, status: { in: ['PENDING', 'ACTIVE'] } },
          select: {
            status: true,
            course: { select: { id: true, name: true } },
          },
        },
      },
    })

    return NextResponse.json({
      courseId,
      course,
      profiles: profiles.map((p) => ({
        ...p,
        pending_enrollments: p.enrollments.filter((e) => e.status === 'PENDING').length,
        active_enrollments: p.enrollments.filter((e) => e.status === 'ACTIVE').length,
      })),
    })
  } catch (error: unknown) {
    console.error('Error fetching students:', error)
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
    const { id, status, action } = body as {
      id?: string
      status?: string
      action?: 'DELETE' | 'RESTORE'
    }

    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 })
    }

    const existing = await prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        status: true,
        deleted_at: true,
        full_name: true,
      },
    })

    if (!existing || existing.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Aluno não encontrado' }, { status: 404 })
    }

    if (action === 'DELETE') {
      if (existing.deleted_at) {
        return NextResponse.json({ error: 'Aluno já está excluído' }, { status: 400 })
      }

      const updatedProfile = await prisma.profile.update({
        where: { id },
        data: {
          deleted_at: new Date(),
          session_version: { increment: 1 },
        },
      })

      await prisma.auditLog.create({
        data: {
          user_id: user.id,
          action: 'SOFT_DELETE_STUDENT',
          entity_type: 'PROFILE',
          entity_id: id,
          metadata: JSON.stringify({ previous_status: existing.status }),
        },
      })

      return NextResponse.json({ profile: updatedProfile })
    }

    if (action === 'RESTORE') {
      if (!existing.deleted_at) {
        return NextResponse.json({ error: 'Aluno não está excluído' }, { status: 400 })
      }

      const updatedProfile = await prisma.profile.update({
        where: { id },
        data: { deleted_at: null },
      })

      await prisma.auditLog.create({
        data: {
          user_id: user.id,
          action: 'RESTORE_STUDENT',
          entity_type: 'PROFILE',
          entity_id: id,
          metadata: JSON.stringify({ status: existing.status }),
        },
      })

      return NextResponse.json({ profile: updatedProfile })
    }

    if (!status) {
      return NextResponse.json({ error: 'Missing status or action' }, { status: 400 })
    }

    if (existing.deleted_at) {
      return NextResponse.json(
        { error: 'Restaure o aluno antes de alterar o status' },
        { status: 400 }
      )
    }

    const updatedProfile = await prisma.profile.update({
      where: { id },
      data: { status },
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'UPDATE_STUDENT_STATUS',
        entity_type: 'PROFILE',
        entity_id: id,
        metadata: JSON.stringify({ status }),
      },
    })

    return NextResponse.json({ profile: updatedProfile })
  } catch (error: unknown) {
    console.error('Error updating student:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
