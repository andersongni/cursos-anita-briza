import { createClient, type Client } from '@libsql/client'
import { getDatabaseAuthToken, getDatabaseUrl } from '@/lib/db-url'
import { SCHEMA_MIGRATIONS } from '@/lib/schema-migrations'

function isAlreadyExistsError(message: string): boolean {
  return /duplicate column|already exists|duplicate table/i.test(message)
}

async function applyMigrations(client: Client): Promise<{
  applied: string[]
  skipped: string[]
}> {
  const applied: string[] = []
  const skipped: string[] = []

  for (const migration of SCHEMA_MIGRATIONS) {
    try {
      await client.execute(migration.sql)
      applied.push(migration.id)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (isAlreadyExistsError(message)) {
        skipped.push(migration.id)
        continue
      }
      throw Object.assign(
        new Error(`Migração ${migration.id} falhou: ${message}`),
        { cause: err }
      )
    }
  }

  return { applied, skipped }
}

/**
 * Garante schema aditivo no SQLite/Turso (idempotente).
 * Usa libsql direto — não depende do Prisma Client.
 */
export async function ensureSchemaColumns(): Promise<{
  applied: string[]
  skipped: string[]
  deleted_at: boolean
}> {
  const url = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()
  const client = createClient(authToken ? { url, authToken } : { url })

  try {
    const { applied, skipped } = await applyMigrations(client)
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
