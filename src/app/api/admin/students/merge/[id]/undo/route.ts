import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { canUndoMerge, undoMergeProfiles } from '@/lib/students/merge-profiles'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await verifyAdmin()
    const { id } = await params
    const check = await canUndoMerge(id)
    if (!check.ok) {
      return NextResponse.json({ ok: false, error: check.error })
    }
    return NextResponse.json({
      ok: true,
      mergeId: check.merge.id,
      survivorId: check.merge.survivor_id,
      absorbedId: check.merge.absorbed_id,
    })
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao verificar merge' },
      { status: err.status || 500 }
    )
  }
}

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await verifyAdmin()
    const { id } = await params
    await undoMergeProfiles(id, user.id)
    return NextResponse.json({ success: true })
  } catch (error: unknown) {
    console.error('Undo merge error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao desfazer merge' },
      { status: err.status || 500 }
    )
  }
}
