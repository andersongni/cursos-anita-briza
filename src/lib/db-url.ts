import path from 'node:path'

/** URL SQLite relativa — funciona no Windows e no Unix (offline). */
export function getDatabaseUrl(): string {
  return process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
}

/** Caminho absoluto do arquivo .db (útil para logs/debug). */
export function getDatabasePath(): string {
  const url = getDatabaseUrl()
  const relative = url.replace(/^file:/, '')
  return path.resolve(relative)
}
