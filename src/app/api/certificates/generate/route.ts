import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'
import { generateCertificateCode } from '@/lib/utils'
import { getCertificateSettings } from '@/lib/certificate/settings'

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
      include: { student: true },
    })

    if (!assessment) {
      return NextResponse.json({ error: 'Avaliação não encontrada' }, { status: 404 })
    }

    if (assessment.student_id !== user.id) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    if (
      assessment.type !== 'PROVA' ||
      assessment.status !== 'COMPLETED' ||
      !assessment.passed
    ) {
      return NextResponse.json(
        { error: 'Avaliação não elegível para certificado' },
        { status: 400 }
      )
    }

    const existingCert = await prisma.certificate.findUnique({
      where: { assessment_id },
    })

    if (existingCert) {
      return NextResponse.json({
        message: 'Certificado já gerado',
        certificate: existingCert,
      })
    }

    const settings = await getCertificateSettings()
    const certificate_code = generateCertificateCode()

    const newCertificate = await prisma.certificate.create({
      data: {
        student_id: user.id,
        assessment_id,
        certificate_code,
        student_name_snapshot: assessment.student.full_name,
        course_name_snapshot: settings.courseName,
        completion_date: assessment.completed_at || new Date(),
        score_snapshot: assessment.score || 0,
      },
    })

    return NextResponse.json(
      { success: true, certificate: newCertificate },
      { status: 201 }
    )
  } catch (err: any) {
    console.error('Certificate Generation Error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro interno no servidor' },
      { status: err.status || 500 }
    )
  }
}
