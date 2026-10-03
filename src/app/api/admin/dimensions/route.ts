import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET() {
  try {
    await verifyAdmin()
    const dimensions = await prisma.dimension.findMany({
      orderBy: { display_order: 'asc' }
    })
    return NextResponse.json({ dimensions })
  } catch (error: any) {
    console.error('Error fetching dimensions:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}

export async function POST(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json()
    const { name, description, weight, target_percentage, display_order } = body

    const dimension = await prisma.dimension.create({
      data: { name, description, weight, target_percentage, display_order }
    })

    return NextResponse.json({ dimension })
  } catch (error: any) {
    console.error('Error creating dimension:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json()
    const { id, name, description, weight, target_percentage, display_order, active } = body

    if (!id) {
      return NextResponse.json({ error: 'Missing dimension id' }, { status: 400 })
    }

    const data: any = {}
    if (name !== undefined) data.name = name
    if (description !== undefined) data.description = description
    if (weight !== undefined) data.weight = weight
    if (target_percentage !== undefined) data.target_percentage = target_percentage
    if (display_order !== undefined) data.display_order = display_order
    if (active !== undefined) data.active = active

    const dimension = await prisma.dimension.update({
      where: { id },
      data
    })

    return NextResponse.json({ dimension })
  } catch (error: any) {
    console.error('Error updating dimension:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}

export async function DELETE(req: Request) {
  try {
    await verifyAdmin()
    const body = await req.json().catch(() => ({}))
    const id = body.id || new URL(req.url).searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Missing dimension id' }, { status: 400 })
    }

    const activeQuestionsCount = await prisma.question.count({
      where: { dimension_id: id, active: true }
    })

    if (activeQuestionsCount > 0) {
      return NextResponse.json({ error: 'Cannot delete dimension with active questions' }, { status: 400 })
    }

    await prisma.dimension.delete({
      where: { id }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting dimension:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}
