import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'

/** Lista certificados do aluno logado (+ elegibilidade para emitir). */
export async function GET() {
  try {
    const { user } = await verifyAuth()

    const [certificates, passedProva] = await Promise.all([
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
    ])

    return NextResponse.json({
      certificates,
      eligibleAssessmentId: passedProva?.id ?? null,
    })
  } catch (err: any) {
    console.error('List Certificates Error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro interno no servidor' },
      { status: err.status || 500 }
    )
  }
}
