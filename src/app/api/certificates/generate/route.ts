import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'
import { issueCertificateForAssessment } from '@/lib/certificate/issue'

export async function POST(req: Request) {
  try {
    const { user } = await verifyAuth()
    const body = await req.json()
    const { assessment_id } = body

    if (!assessment_id) {
      return NextResponse.json(
        { error: 'Assessment ID é obrigatório' },
        { status: 400 }
      )
    }

    const assessment = await prisma.assessment.findUnique({
      where: { id: assessment_id },
      select: { id: true, student_id: true },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }

    if (assessment.student_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const result = await issueCertificateForAssessment(assessment_id)
    if (!result.ok) {
      return NextResponse.json({ error: result.reason }, { status: 400 })
    }

    if (!result.created) {
      return NextResponse.json({
        message: 'Certificado já gerado',
        certificate: result.certificate,
      })
    }

    return NextResponse.json(
      { success: true, certificate: result.certificate },
      { status: 201 }
    )
  } catch (err: unknown) {
    console.error('Certificate Generation Error:', err)
    const e = err as { message?: string; status?: number }
    return NextResponse.json(
      { error: e.message || 'Erro interno no servidor' },
      { status: e.status || 500 }
    )
  }
}
