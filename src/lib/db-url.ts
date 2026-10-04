import path from 'node:path'

function cleanEnv(value: string | undefined): string | undefined {
  if (!value) return undefined
  const cleaned = value.trim().replace(/^"|"$/g, '')
  return cleaned.length > 0 ? cleaned : undefined
}

function isRemoteLibsqlUrl(url: string): boolean {
  return url.startsWith('libsql://') || url.startsWith('https://')
}

/**
 * Deploy real na Vercel (build/runtime na nuvem).
 * `vercel env pull` grava VERCEL=1 e VERCEL_ENV no PC, mas VERCEL_URL fica vazio.
 */
function isVercelDeployment(): boolean {
  return process.env.VERCEL === '1' && Boolean(cleanEnv(process.env.VERCEL_URL))
}

function resolveDatabaseUrl(): string {
  const primary = cleanEnv(process.env.DATABASE_URL)
  const fallbacks = [
    cleanEnv(process.env.TURSO_DATABASE_URL),
    cleanEnv(process.env.PROD_TURSO_DATABASE_URL),
  ].filter((value): value is string => Boolean(value))

  // Deploy Vercel: sempre Turso (libsql/https)
  if (isVercelDeployment()) {
    const candidates = [primary, ...fallbacks].filter((value): value is string => Boolean(value))
    const remote = candidates.find(isRemoteLibsqlUrl)
    if (!remote) {
      throw new Error(
        'DATABASE_URL no Vercel deve ser libsql://... (Turso). Arquivo SQLite local não persiste.'
      )
    }
    return remote
  }

  // Local: DATABASE_URL explícito tem prioridade (não sobrescrever file: com PROD_TURSO_*)
  if (primary) return primary

  const remote = fallbacks.find(isRemoteLibsqlUrl)
  return remote || 'file:./prisma/dev.db'
}

/**
 * Absolute file: URL for local SQLite.
 * Scoped under prisma/ + turbopackIgnore so Next does not trace the whole repo.
 */
function toAbsoluteSqliteUrl(url: string): string {
  if (!url.startsWith('file:')) return url
  if (url.startsWith('file:/') || /^file:[A-Za-z]:/.test(url)) return url

  const relative = url.replace(/^file:/, '').replace(/^\.\//, '').replace(/\\/g, '/')
  const parts = relative.split('/').filter(Boolean)

  // Prefer the usual prisma/*.db layout (static folder segment for Turbopack)
  if (parts[0] === 'prisma' && parts.length >= 2) {
    const fileName = parts.slice(1).join('/')
    return `file:${path.join(/* turbopackIgnore: true */ process.cwd(), 'prisma', fileName)}`
  }

  return `file:${path.join(/* turbopackIgnore: true */ process.cwd(), ...parts)}`
}

/** URL do banco: Turso (`libsql://...`) ou SQLite local (`file:./prisma/dev.db`). */
export function getDatabaseUrl(): string {
  return toAbsoluteSqliteUrl(resolveDatabaseUrl())
}

/** Token do Turso — só usado com URL remota libsql/https. */
export function getDatabaseAuthToken(): string | undefined {
  const token =
    cleanEnv(process.env.TURSO_AUTH_TOKEN) ||
    cleanEnv(process.env.DATABASE_AUTH_TOKEN) ||
    cleanEnv(process.env.PROD_TURSO_AUTH_TOKEN)

  const url = getDatabaseUrl()
  if (!isRemoteLibsqlUrl(url)) return undefined

  if (isVercelDeployment() && !token) {
    throw new Error('TURSO_AUTH_TOKEN é obrigatório no Vercel.')
  }

  return token
}

/** Caminho absoluto do arquivo .db (útil para logs/debug local). */
export function getDatabasePath(): string {
  const url = getDatabaseUrl()
  return url.replace(/^file:/, '')
}
