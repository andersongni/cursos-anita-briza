import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'
import { getCertificateSettings } from '@/lib/certificate/settings'

/** Lista certificados do aluno logado (+ elegibilidade para emitir). */
export async function GET() {
  try {
    const { user } = await verifyAuth()

    const [certificates, passedProva, settings] = await Promise.all([
      prisma.certificate.findMany({
        where: { student_id: user.id },
        orderBy: { created_at: 'desc' },
      }),
      prisma.assessment.findFirst({
        where: {
          student_id: user.id,
          type: 'PROVA',
          status: 'COMPLETED',
          passed: true,
          certificate: null,
        },
        orderBy: { completed_at: 'desc' },
      }),
      getCertificateSettings(),
    ])

    return NextResponse.json({
      certificates: certificates.map((c) => ({
        ...c,
        course_name_snapshot: settings.courseName,
      })),
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
