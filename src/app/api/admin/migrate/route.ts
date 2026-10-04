import { createClient } from '@libsql/client'
import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/lib/auth/session'
import { getDatabaseAuthToken, getDatabaseUrl } from '@/lib/db-url'

/**
 * Aplica migrações aditivas no banco atual (Turso/SQLite).
 * Não usa o Prisma Client (que já espera colunas novas) — só SQL via libsql.
 *
 * Autorização (qualquer uma):
 * - cookie de admin válido (JWT), ou
 * - header `x-migrate-secret` igual a JWT_SECRET (bootstrap quando o login quebra)
 */
export async function POST(request: NextRequest) {
  try {
    const secret = request.headers.get('x-migrate-secret')
    const expected = process.env.JWT_SECRET
    const secretOk = Boolean(expected && secret && secret === expected)

    if (!secretOk) {
      const session = await getSession()
      if (!session || session.role !== 'ADMIN') {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
      }
    }

    const url = getDatabaseUrl()
    const authToken = getDatabaseAuthToken()
    const client = createClient(authToken ? { url, authToken } : { url })

    const applied: string[] = []
    const skipped: string[] = []

    const statements = [
      {
        name: 'Profile.deleted_at',
        sql: 'ALTER TABLE Profile ADD COLUMN deleted_at DATETIME',
      },
    ]

    for (const { name, sql } of statements) {
      try {
        await client.execute(sql)
        applied.push(name)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        if (/duplicate column|already exists/i.test(message)) {
          skipped.push(name)
          continue
        }
        client.close()
        throw err
      }
    }

    const cols = await client.execute('PRAGMA table_info(Profile)')
    const profileColumns = cols.rows.map((r) => String(r.name))
    client.close()

    return NextResponse.json({
      ok: true,
      applied,
      skipped,
      deleted_at: profileColumns.includes('deleted_at'),
    })
  } catch (error: unknown) {
    console.error('Admin migrate error:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
