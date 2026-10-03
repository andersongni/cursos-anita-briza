import path from 'node:path'

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined
  const cleaned = value.trim().replace(/^"|"$/g, '')
  return cleaned.length > 0 ? cleaned : undefined
}

function isRemoteLibsqlUrl(url: string): boolean {
  return url.startsWith('libsql://') || url.startsWith('https://')
}

function resolveDatabaseUrl(): string {
  const candidates = [
    cleanEnv(process.env.DATABASE_URL),
    cleanEnv(process.env.TURSO_DATABASE_URL),
    cleanEnv(process.env.PROD_TURSO_DATABASE_URL),
  ].filter((value): value is string => Boolean(value))

  // Em produção serverless, prioriza Turso mesmo se DATABASE_URL estiver como file:
  const remote = candidates.find(isRemoteLibsqlUrl)
  if (process.env.VERCEL) {
    if (!remote) {
      throw new Error(
        'DATABASE_URL no Vercel deve ser libsql://... (Turso). Arquivo SQLite local não persiste.'
      )
    }
    return remote
  }

  return remote || candidates[0] || 'file:./prisma/dev.db'
}

/** URL do banco: Turso (`libsql://...`) ou SQLite local (`file:./prisma/dev.db`). */
export function getDatabaseUrl(): string {
  return resolveDatabaseUrl()
}

/** Token do Turso — só usado com URL remota libsql/https. */
export function getDatabaseAuthToken(): string | undefined {
  const token =
    cleanEnv(process.env.TURSO_AUTH_TOKEN) ||
    cleanEnv(process.env.DATABASE_AUTH_TOKEN) ||
    cleanEnv(process.env.PROD_TURSO_AUTH_TOKEN)

  const url = getDatabaseUrl()
  if (!isRemoteLibsqlUrl(url)) return undefined

  if (process.env.VERCEL && !token) {
    throw new Error('TURSO_AUTH_TOKEN é obrigatório no Vercel.')
  }

  return token
}

/** Caminho absoluto do arquivo .db (útil para logs/debug local). */
export function getDatabasePath(): string {
  const url = getDatabaseUrl()
  const relative = url.replace(/^file:/, '')
  return path.resolve(relative)
}
