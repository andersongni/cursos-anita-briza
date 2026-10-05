import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'
import { listStudentCourseIds } from '@/lib/courses'

/** Lista todos os certificados do aluno (+ elegibilidade para emitir em algum curso). */
export async function GET() {
  try {
    const { user } = await verifyAuth()

    const enrolledIds = await listStudentCourseIds(user.id).catch(() => [] as string[])

    const [certificates, passedProva] = await Promise.all([
      prisma.certificate.findMany({
        where: { student_id: user.id },
        orderBy: { created_at: 'desc' },
        include: {
          course: { select: { id: true, name: true } },
        },
      }),
      enrolledIds.length > 0
        ? prisma.assessment.findFirst({
            where: {
              student_id: user.id,
              course_id: { in: enrolledIds },
              type: 'PROVA',
              status: 'COMPLETED',
              passed: true,
              certificate: null,
            },
            orderBy: { completed_at: 'desc' },
          })
        : Promise.resolve(null),
    ])

    return NextResponse.json({
      certificates,
      eligibleAssessmentId: passedProva?.id ?? null,
    })
  } catch (err: unknown) {
    console.error('List Certificates Error:', err)
    const e = err as { message?: string; status?: number }
    return NextResponse.json(
      { error: e.message || 'Erro interno no servidor' },
      { status: e.status || 500 }
    )
  }
}
