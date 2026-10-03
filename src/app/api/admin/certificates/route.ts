import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'
import { getCertificateSettings } from '@/lib/certificate/settings'

export async function GET(req: Request) {
  try {
    await verifyAdmin()

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim().toLowerCase()

    const [certificates, settings] = await Promise.all([
      prisma.certificate.findMany({
        include: {
          student: {
            select: { id: true, full_name: true, username: true },
          },
        },
        orderBy: { created_at: 'desc' },
      }),
      getCertificateSettings(),
    ])

    const withCurrentCourse = certificates.map((c) => ({
      ...c,
      course_name_snapshot: settings.courseName,
    }))

    const filtered = q
      ? withCurrentCourse.filter(
          (c) =>
            c.student.full_name.toLowerCase().includes(q) ||
            c.certificate_code.toLowerCase().includes(q) ||
            c.student.username.toLowerCase().includes(q)
        )
      : withCurrentCourse

    return NextResponse.json({ certificates: filtered })
  } catch (err: unknown) {
    console.error('Admin List Certificates Error:', err)
    const e = err as { message?: string; status?: number }
    return NextResponse.json(
      { error: e.message || 'Erro interno no servidor' },
      { status: e.status || 500 }
    )
  }
}
