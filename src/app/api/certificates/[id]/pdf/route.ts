import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'
import { generateCertificatePDF } from '@/lib/certificate/generate-pdf'
import { getCertificateSettings } from '@/lib/certificate/settings'
import { formatDate } from '@/lib/utils'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { user, profile } = await verifyAuth()
    const { id } = await params
    const download = req.nextUrl.searchParams.get('download') === '1'

    const certificate = await prisma.certificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificado não encontrado' }, { status: 404 })
    }

    if (certificate.student_id !== user.id && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const settings = await getCertificateSettings()

    const doc = generateCertificatePDF({
      studentName: certificate.student_name_snapshot,
      courseName: certificate.course_name_snapshot || settings.courseName,
      institutionName: settings.institutionName,
      completionDate: formatDate(certificate.completion_date),
      score: certificate.score_snapshot ?? 0,
      certificateCode: certificate.certificate_code,
      templateText: settings.templateText,
    })

    const buffer = Buffer.from(doc.output('arraybuffer'))
    const filename = `certificado-${certificate.certificate_code}.pdf`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': download
          ? `attachment; filename="${filename}"`
          : `inline; filename="${filename}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err: any) {
    const status = err.status ?? 500
    console.error('Certificate PDF Error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro ao gerar PDF' },
      { status }
    )
  }
}
