import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { ensureCourses, listActiveCourses } from '@/lib/courses'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin()
    await ensureCourses()
    const { id } = await params

    const profile = await prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        deleted_at: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Perfil não é de aluno' }, { status: 400 })
    }

    const [assessments, certificates, enrollments, courses] = await Promise.all([
      prisma.assessment.findMany({
        where: { student_id: id },
        include: { course: { select: { id: true, name: true } } },
        orderBy: { created_at: 'desc' },
      }),
      prisma.certificate.findMany({
        where: { student_id: id },
        orderBy: { created_at: 'desc' },
      }),
      prisma.courseEnrollment.findMany({
        where: { student_id: id },
        select: {
          id: true,
          course_id: true,
          status: true,
          enrolled_at: true,
          course: { select: { id: true, name: true, slug: true } },
        },
      }),
      listActiveCourses(),
    ])

    return NextResponse.json({
      profile: {
        ...profile,
        assessments,
        certificates,
        enrollments,
      },
      courses,
    })
  } catch (error: unknown) {
    console.error('Error fetching student detail:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
