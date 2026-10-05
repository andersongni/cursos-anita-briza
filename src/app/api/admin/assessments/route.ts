import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { resolveAdminCourseId } from '@/lib/courses'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const result = searchParams.get('result')
    const q = searchParams.get('q')?.trim().toLowerCase()
    const courseId = searchParams.get('courseId') || (await resolveAdminCourseId())

    const where: Record<string, unknown> = { course_id: courseId }
    if (type) where.type = type
    if (result === 'APROVADO') {
      where.status = 'COMPLETED'
      where.passed = true
    } else if (result === 'REPROVADO') {
      where.status = 'COMPLETED'
      where.passed = false
    }

    const assessments = await prisma.assessment.findMany({
      where,
      include: {
        student: { select: { id: true, full_name: true, username: true } },
        course: { select: { id: true, name: true } },
      },
      orderBy: { started_at: 'desc' },
    })

    const filtered = q
      ? assessments.filter(
          (a) =>
            a.student.full_name.toLowerCase().includes(q) ||
            a.student.username.toLowerCase().includes(q)
        )
      : assessments

    return NextResponse.json({ assessments: filtered, courseId })
  } catch (error: unknown) {
    console.error('Error listing assessments:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
