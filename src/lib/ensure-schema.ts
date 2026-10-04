import { createClient } from '@libsql/client'
import { getDatabaseAuthToken, getDatabaseUrl } from '@/lib/db-url'

const ALTERS = ['ALTER TABLE Profile ADD COLUMN deleted_at DATETIME'] as const

/**
 * Garante colunas aditivas no SQLite/Turso (idempotente).
 * Usa libsql direto para não depender do Prisma Client.
 */
export async function ensureSchemaColumns(): Promise<{
  applied: string[]
  skipped: string[]
  deleted_at: boolean
}> {
  const url = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()
  const client = createClient(authToken ? { url, authToken } : { url })

  const applied: string[] = []
  const skipped: string[] = []

  try {
    for (const sql of ALTERS) {
      try {
        await client.execute(sql)
        applied.push(sql)
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        if (/duplicate column|already exists/i.test(message)) {
          skipped.push(sql)
          continue
        }
        throw err
      }
    }

    const cols = await client.execute('PRAGMA table_info(Profile)')
    const deleted_at = cols.rows.some((r) => String(r.name) === 'deleted_at')
    return { applied, skipped, deleted_at }
  } finally {
    client.close()
  }
}

export async function hasDeletedAtColumn(): Promise<boolean> {
  const url = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()
  const client = createClient(authToken ? { url, authToken } : { url })
  try {
    const cols = await client.execute('PRAGMA table_info(Profile)')
    return cols.rows.some((r) => String(r.name) === 'deleted_at')
  } finally {
    client.close()
  }
}
