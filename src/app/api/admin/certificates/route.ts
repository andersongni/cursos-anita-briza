import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'
import { listCoursesForAdmin } from '@/lib/courses'

export async function GET(req: Request) {
  try {
    await verifyAdmin()

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim().toLowerCase()
    /** vazio / "all" = todos os cursos */
    const courseIdRaw = searchParams.get('courseId')?.trim() || ''
    const courseId =
      !courseIdRaw || courseIdRaw === 'all' ? null : courseIdRaw

    const [certificates, courses] = await Promise.all([
      prisma.certificate.findMany({
        where: courseId ? { course_id: courseId } : undefined,
        include: {
          student: {
            select: { id: true, full_name: true, username: true },
          },
          course: { select: { id: true, name: true, active: true } },
        },
        orderBy: { created_at: 'desc' },
      }),
      listCoursesForAdmin('include'),
    ])

    const filtered = q
      ? certificates.filter(
          (c) =>
            c.student.full_name.toLowerCase().includes(q) ||
            c.certificate_code.toLowerCase().includes(q) ||
            c.student.username.toLowerCase().includes(q) ||
            c.course_name_snapshot.toLowerCase().includes(q) ||
            (c.course?.name ?? '').toLowerCase().includes(q)
        )
      : certificates

    return NextResponse.json({
      certificates: filtered,
      courseId: courseId ?? 'all',
      courses,
    })
  } catch (err: unknown) {
    console.error('Admin List Certificates Error:', err)
    const e = err as { message?: string; status?: number }
    return NextResponse.json(
      { error: e.message || 'Erro interno no servidor' },
      { status: e.status || 500 }
    )
  }
}
