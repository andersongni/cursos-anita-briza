import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import {
  getMergePreview,
  mergeProfiles,
  type MergeIdentitySource,
} from '@/lib/students/merge-profiles'

function asSource(v: unknown): MergeIdentitySource | null {
  return v === 'survivor' || v === 'absorbed' ? v : null
}

/** Prévia do merge: GET ?survivorId=&absorbedId= */
export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const survivorId = searchParams.get('survivorId')?.trim() || ''
    const absorbedId = searchParams.get('absorbedId')?.trim() || ''
    if (!survivorId || !absorbedId) {
      return NextResponse.json(
        { error: 'Informe survivorId e absorbedId' },
        { status: 400 }
      )
    }
    const preview = await getMergePreview(survivorId, absorbedId)
    if (!preview.ok) {
      return NextResponse.json({ error: preview.error }, { status: 400 })
    }
    return NextResponse.json(preview)
  } catch (error: unknown) {
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao pré-visualizar merge' },
      { status: err.status || 500 }
    )
  }
}

/** Executa o merge. */
export async function POST(req: Request) {
  try {
    const { user } = await verifyAdmin()
    const body = await req.json().catch(() => ({}))
    const survivorId =
      typeof body.survivorId === 'string' ? body.survivorId.trim() : ''
    const absorbedId =
      typeof body.absorbedId === 'string' ? body.absorbedId.trim() : ''
    const keepUsernameFrom = asSource(body.keepUsernameFrom)
    const keepPasswordFrom = asSource(body.keepPasswordFrom)
    const keepFullNameFrom = asSource(body.keepFullNameFrom) ?? 'survivor'
    const keepEmailFrom = asSource(body.keepEmailFrom) ?? 'survivor'
    const keepPhoneFrom = asSource(body.keepPhoneFrom) ?? 'survivor'

    if (!survivorId || !absorbedId || !keepUsernameFrom || !keepPasswordFrom) {
      return NextResponse.json(
        {
          error:
            'Informe survivorId, absorbedId, keepUsernameFrom e keepPasswordFrom (survivor|absorbed)',
        },
        { status: 400 }
      )
    }

    const merge = await mergeProfiles({
      survivorId,
      absorbedId,
      keepUsernameFrom,
      keepPasswordFrom,
      keepFullNameFrom,
      keepEmailFrom,
      keepPhoneFrom,
      adminUserId: user.id,
    })

    return NextResponse.json({
      success: true,
      mergeId: merge.id,
      survivorId: merge.survivor_id,
      absorbedId: merge.absorbed_id,
    })
  } catch (error: unknown) {
    console.error('Merge students error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Erro ao mesclar alunos' },
      { status: err.status || 500 }
    )
  }
}
