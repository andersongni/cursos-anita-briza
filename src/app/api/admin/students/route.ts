import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    
    const where: any = { role: 'STUDENT' }
    if (status) {
      where.status = status
    }

    const profiles = await prisma.profile.findMany({
      where,
      orderBy: { created_at: 'desc' }
    })

    return NextResponse.json({ profiles })
  } catch (error: any) {
    console.error('Error fetching students:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}

export async function PATCH(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json()
    const { id, status } = body

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 })
    }

    const updatedProfile = await prisma.profile.update({
      where: { id },
      data: { status },
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'UPDATE_STUDENT_STATUS',
        entity_type: 'PROFILE',
        entity_id: id,
        metadata: JSON.stringify({ status }),
      },
    })

    return NextResponse.json({ profile: updatedProfile })
  } catch (error: any) {
    console.error('Error updating student status:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    )
  }
}
