import { NextResponse } from 'next/server'
import { verifyAuth } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(_req: Request, { params }: RouteParams) {
  try {
    const { user, profile } = await verifyAuth()
    const { id } = await params

    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        student: {
          select: { id: true, full_name: true, username: true },
        },
        assessment: {
          select: { id: true, type: true, score: true, completed_at: true },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificado não encontrado' }, { status: 404 })
    }

    if (certificate.student_id !== user.id && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    return NextResponse.json({ certificate })
  } catch (err: any) {
    console.error('Get Certificate Error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro interno no servidor' },
      { status: err.status || 500 }
    )
  }
}
