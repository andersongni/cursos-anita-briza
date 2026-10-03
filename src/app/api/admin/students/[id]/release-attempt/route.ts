import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { user } = await verifyAdmin()
    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const { reason } = body

    await prisma.attemptRelease.create({
      data: {
        student_id: id,
        released_by: user.id,
        reason: reason ?? null
      }
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'RELEASE_ATTEMPT',
        entity_type: 'ATTEMPT_RELEASE',
        entity_id: id,
        metadata: reason ? JSON.stringify({ reason }) : null,
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error releasing attempt:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await verifyAdmin()
    const { id } = await params

    await prisma.attemptRelease.updateMany({
      where: {
        student_id: id,
        used: false,
        cancelled: false
      },
      data: {
        cancelled: true
      }
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error cancelling attempts:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}
