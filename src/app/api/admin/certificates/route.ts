import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { prisma } from '@/lib/db'

export async function GET(req: Request) {
  try {
    await verifyAdmin()

    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim().toLowerCase()

    const certificates = await prisma.certificate.findMany({
      include: {
        student: {
          select: { id: true, full_name: true, username: true },
        },
      },
      orderBy: { created_at: 'desc' },
    })

    const filtered = q
      ? certificates.filter(
          (c) =>
            c.student.full_name.toLowerCase().includes(q) ||
            c.certificate_code.toLowerCase().includes(q) ||
            c.student.username.toLowerCase().includes(q)
        )
      : certificates

    return NextResponse.json({ certificates: filtered })
  } catch (err: any) {
    console.error('Admin List Certificates Error:', err)
    return NextResponse.json(
      { error: err.message || 'Erro interno no servidor' },
      { status: err.status || 500 }
    )
  }
}
