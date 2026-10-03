import path from 'node:path'

/** URL do banco: Turso (`libsql://...`) ou SQLite local (`file:./prisma/dev.db`). */
export function getDatabaseUrl(): string {
  return (
    process.env.DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    'file:./prisma/dev.db'
  )
}

/** Token do Turso — só usado com URL remota libsql/https. */
export function getDatabaseAuthToken(): string | undefined {
  const token = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN
  if (!token) return undefined

  const url = getDatabaseUrl()
  if (url.startsWith('file:')) return undefined
  return token
}

/** Caminho absoluto do arquivo .db (útil para logs/debug local). */
export function getDatabasePath(): string {
  const url = getDatabaseUrl()
  const relative = url.replace(/^file:/, '')
  return path.resolve(relative)
}
