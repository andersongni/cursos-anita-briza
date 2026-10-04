import { NextResponse } from 'next/server'
import { verifyAdmin } from '@/lib/auth/verify'
import { listTypingRanking } from '@/lib/exercises/typing-ranking'

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const { searchParams } = new URL(req.url)
    const q = (searchParams.get('q') || '').trim().toLowerCase()

    const { rows, totalAttempts } = await listTypingRanking()

    const filtered = q
      ? rows.filter(
          (row) =>
            row.fullName.toLowerCase().includes(q) ||
            row.username.toLowerCase().includes(q) ||
            row.passageTitle.toLowerCase().includes(q)
        )
      : rows

    return NextResponse.json({
      rows: filtered,
      totalAttempts,
      filteredCount: filtered.length,
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Erro ao carregar ranking'
    return NextResponse.json({ error: message }, { status })
  }
}
