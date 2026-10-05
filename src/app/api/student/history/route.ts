import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { resolveStudentCourseId } from '@/lib/courses'

export async function GET(req: Request) {
  try {
    const { user } = await verifyAuth()
    const courseId = await resolveStudentCourseId(
      user.id,
      new URL(req.url).searchParams.get('courseId')
    )

    const assessments = await prisma.assessment.findMany({
      where: { student_id: user.id, course_id: courseId },
      orderBy: { started_at: 'desc' },
      select: {
        id: true,
        type: true,
        status: true,
        score: true,
        passed: true,
        started_at: true,
        completed_at: true,
        duration_seconds: true,
        attempt_number: true,
        course_id: true,
      },
    })

    return NextResponse.json({
      courseId,
      assessments: assessments.map((a) => ({
        id: a.id,
        type: a.type,
        status: a.status,
        score: a.score,
        passed: a.passed,
        createdAt: a.started_at,
        duration: a.duration_seconds,
        attemptNumber: a.attempt_number,
      })),
    })
  } catch (error: unknown) {
    console.error('Student history error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao buscar histórico' },
      { status: err.status || 500 }
    )
  }
}
