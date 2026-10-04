import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const q = searchParams.get('q')?.trim()

    const feedbacks = await prisma.feedback.findMany({
      where: q
        ? {
            OR: [
              { message: { contains: q } },
              { subject: { contains: q } },
              { user: { full_name: { contains: q } } },
              { user: { username: { contains: q } } },
            ],
          }
        : undefined,
      orderBy: { created_at: 'desc' },
      select: {
        id: true,
        subject: true,
        message: true,
        role: true,
        created_at: true,
        user: {
          select: {
            id: true,
            full_name: true,
            username: true,
            role: true,
            deleted_at: true,
          },
        },
      },
      take: 200,
    })

    return NextResponse.json({
      feedbacks: feedbacks.map((f) => ({
        id: f.id,
        subject: f.subject,
        message: f.message,
        role: f.role,
        created_at: f.created_at,
        user: {
          id: f.user.id,
          full_name: f.user.full_name,
          username: f.user.username,
          role: f.user.role,
          deleted: f.user.deleted_at != null,
        },
      })),
    })
  } catch (error: unknown) {
    console.error('List feedback error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
