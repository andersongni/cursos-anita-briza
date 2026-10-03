import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const result = searchParams.get('result')
    const q = searchParams.get('q')?.trim().toLowerCase()

    const where: any = {}
    if (type) where.type = type
    if (result === 'APROVADO') {
      where.status = 'COMPLETED'
      where.passed = true
    } else if (result === 'REPROVADO') {
      where.status = 'COMPLETED'
      where.passed = false
    }

    const assessments = await prisma.assessment.findMany({
      where,
      include: {
        student: { select: { id: true, full_name: true, username: true } },
      },
      orderBy: { started_at: 'desc' },
    })

    const filtered = q
      ? assessments.filter(
          (a) =>
            a.student.full_name.toLowerCase().includes(q) ||
            a.student.username.toLowerCase().includes(q)
        )
      : assessments

    return NextResponse.json({ assessments: filtered })
  } catch (error: any) {
    console.error('Error listing assessments:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    )
  }
}
