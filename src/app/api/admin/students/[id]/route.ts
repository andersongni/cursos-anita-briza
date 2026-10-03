import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { getCertificateSettings } from '@/lib/certificate/settings'

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin()
    const { id } = await params

    const profile = await prisma.profile.findUnique({
      where: { id },
      select: {
        id: true,
        username: true,
        full_name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        last_login_at: true,
        created_at: true,
        updated_at: true,
      },
    })
    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    if (profile.role !== 'STUDENT') {
      return NextResponse.json({ error: 'Perfil não é de aluno' }, { status: 400 })
    }

    const [assessments, certificates, settings] = await Promise.all([
      prisma.assessment.findMany({
        where: { student_id: id },
        orderBy: { created_at: 'desc' },
      }),
      prisma.certificate.findMany({
        where: { student_id: id },
        orderBy: { created_at: 'desc' },
      }),
      getCertificateSettings(),
    ])

    return NextResponse.json({
      profile: {
        ...profile,
        assessments,
        certificates: certificates.map((c) => ({
          ...c,
          course_name_snapshot: settings.courseName,
        })),
      },
    })
  } catch (error: unknown) {
    console.error('Error fetching student detail:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
