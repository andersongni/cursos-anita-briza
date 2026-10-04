import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'

const MAX_MESSAGE = 2000
const MAX_SUBJECT = 120

export async function POST(req: Request) {
  try {
    const { user, profile } = await verifyAuth()
    const body = await req.json().catch(() => ({}))

    const message = typeof body.message === 'string' ? body.message.trim() : ''
    const subject =
      typeof body.subject === 'string' && body.subject.trim()
        ? body.subject.trim().slice(0, MAX_SUBJECT)
        : null

    if (!message) {
      return NextResponse.json({ error: 'Escreva sua mensagem de feedback' }, { status: 400 })
    }
    if (message.length > MAX_MESSAGE) {
      return NextResponse.json(
        { error: `A mensagem pode ter no máximo ${MAX_MESSAGE} caracteres` },
        { status: 400 }
      )
    }

    const feedback = await prisma.feedback.create({
      data: {
        user_id: user.id,
        role: profile.role,
        subject,
        message,
      },
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'CREATE_FEEDBACK',
        entity_type: 'FEEDBACK',
        entity_id: feedback.id,
      },
    })

    return NextResponse.json({ feedback }, { status: 201 })
  } catch (error: unknown) {
    console.error('Create feedback error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
