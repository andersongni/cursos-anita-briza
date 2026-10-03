import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const type = searchParams.get('type')
    const dimension_id = searchParams.get('dimension_id')
    const active = searchParams.get('active')

    const where: any = {}
    if (type) where.type = type
    if (dimension_id) where.dimension_id = dimension_id
    if (active !== null) where.active = active === 'true'

    const questions = await prisma.question.findMany({
      where,
      include: { dimension: true, options: true },
      orderBy: { created_at: 'desc' }
    })

    return NextResponse.json({ questions })
  } catch (error: any) {
    console.error('Error fetching questions:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json()
    const { type, dimension_id, question_text, options } = body

    if (!Array.isArray(options) || options.length !== 5) {
      return NextResponse.json({ error: 'Exactly 5 options required' }, { status: 400 })
    }

    const correctOptions = options.filter((o: any) => o.is_correct)
    if (correctOptions.length !== 1) {
      return NextResponse.json({ error: 'Exactly 1 correct option required' }, { status: 400 })
    }

    const question = await prisma.question.create({
      data: {
        type,
        dimension_id,
        question_text,
        options: {
          create: options
        }
      },
      include: { options: true }
    })

    return NextResponse.json({ question })
  } catch (error: any) {
    console.error('Error creating question:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}
