import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

export async function POST(req: Request) {
  try {
    const user = await verifyAdmin()
    const body = await req.json()
    const { source_ids, target_name, target_id } = body

    if (!source_ids || !Array.isArray(source_ids) || source_ids.length === 0) {
      return NextResponse.json({ error: 'Missing or empty source_ids' }, { status: 400 })
    }

    const finalTargetId = await prisma.$transaction(async (tx) => {
      let tid = target_id
      if (!tid) {
        if (!target_name) throw new Error('Must provide either target_id or target_name')
        const newDim = await tx.dimension.create({
          data: { name: target_name }
        })
        tid = newDim.id
      }

      await tx.question.updateMany({
        where: { dimension_id: { in: source_ids } },
        data: { dimension_id: tid }
      })

      await tx.dimension.updateMany({
        where: { id: { in: source_ids } },
        data: { active: false }
      })

      return tid
    })

    await prisma.auditLog.create({
      data: {
        user_id: user.id,
        action: 'MERGE_DIMENSIONS',
        entity_type: 'DIMENSION',
        entity_id: finalTargetId,
        metadata: JSON.stringify({ source_ids, target_name }),
      }
    })

    return NextResponse.json({ success: true, target_id: finalTargetId })
  } catch (error: any) {
    console.error('Error merging dimensions:', error)
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: error.status || 500 })
  }
}
