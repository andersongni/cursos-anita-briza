import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    
    const logs = await prisma.auditLog.findMany({
      orderBy: { created_at: 'desc' },
      take: 100,
      include: {
        user: {
          select: {
            username: true,
            full_name: true
          }
        }
      }
    })

    return NextResponse.json({ logs })
  } catch (error: any) {
    console.error('Error fetching audit logs:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}
