import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { ensureSchemaColumns, hasDeletedAtColumn } from '@/lib/ensure-schema'

/**
 * Aplica migrações aditivas no banco atual (Turso/SQLite).
 *
 * Autorização:
 * - se a coluna crítica ainda não existe → permite (recupera outage)
 * - senão: cookie admin OU header x-migrate-secret === JWT_SECRET
 */
export async function POST(request: NextRequest) {
  try {
    const missingCritical = !(await hasDeletedAtColumn())

    if (!missingCritical) {
      const secret = request.headers.get('x-migrate-secret')
      const expected = process.env.JWT_SECRET
      const secretOk = Boolean(expected && secret && secret === expected)

      if (!secretOk) {
        const session = await getSession()
        if (!session || session.role !== 'ADMIN') {
          return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }
      }
    }

    const result = await ensureSchemaColumns()
    return NextResponse.json({ ok: true, ...result })
  } catch (error: unknown) {
    console.error('Admin migrate error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
