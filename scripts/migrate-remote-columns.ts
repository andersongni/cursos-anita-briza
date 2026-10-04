/**
 * Aplica colunas novas no Turso sem recriar o banco nem rodar seed.
 *
 * Uso:
 *   npm run db:migrate:remote
 * (usa DATABASE_URL / TURSO_* / PROD_TURSO_* do ambiente)
 */
import { createClient } from '@libsql/client'
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'

function loadEnvFile(filePath: string, { override = false } = {}) {
  if (!existsSync(filePath)) return
  const text = readFileSync(filePath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (override || !process.env[key]) {
      process.env[key] = value
    }
  }
}

// Production pull (Turso) tem prioridade sobre .env.local com file:
loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env.production.local'), { override: true })

const ALTERS = [
  'ALTER TABLE Profile ADD COLUMN deleted_at DATETIME',
] as const

/** Normaliza URLs Turso/Prisma para o formato aceito pelo @libsql/client. */
function normalizeRemoteUrl(raw: string): string | null {
  let url = raw.trim()
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'"))
  ) {
    url = url.slice(1, -1).trim()
  }
  // prisma+libsql://host → libsql://host
  if (url.startsWith('prisma+libsql://')) {
    url = 'libsql://' + url.slice('prisma+libsql://'.length)
  }
  if (url.startsWith('libsql://') || url.startsWith('https://')) return url
  return null
}

function describeUrl(raw: string | undefined): string {
  if (!raw) return '(vazia)'
  const n = normalizeRemoteUrl(raw)
  return `len=${raw.length} hasLibsql=${raw.includes('libsql')} hasHttps=${raw.includes('https')} normalized=${Boolean(n)}`
}

async function main() {
  const urlCandidates: Array<[string, string | undefined]> = [
    ['PROD_TURSO_DATABASE_URL', process.env.PROD_TURSO_DATABASE_URL],
    ['TURSO_DATABASE_URL', process.env.TURSO_DATABASE_URL],
    ['DATABASE_URL', process.env.DATABASE_URL],
  ]

  let pickedKey: string | undefined
  let url: string | undefined
  for (const [key, value] of urlCandidates) {
    const normalized = value ? normalizeRemoteUrl(value) : null
    if (normalized) {
      pickedKey = key
      url = normalized
      break
    }
  }

  const authToken = (
    process.env.PROD_TURSO_AUTH_TOKEN ||
    process.env.TURSO_AUTH_TOKEN ||
    process.env.DATABASE_AUTH_TOKEN
  )?.trim()

  if (!url || !pickedKey) {
    console.error('URL remota Turso não encontrada (libsql:// ou https://).')
    for (const [k, v] of urlCandidates) {
      console.error(`  ${k}: ${describeUrl(v)}`)
    }
    process.exit(1)
  }
  if (!authToken) {
    console.error('Falta TURSO_AUTH_TOKEN / PROD_TURSO_AUTH_TOKEN.')
    process.exit(1)
  }

  console.log('Usando', pickedKey, describeUrl(url))
  const client = createClient({ url, authToken })

  for (const sql of ALTERS) {
    try {
      await client.execute(sql)
      console.log('OK ', sql)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (/duplicate column|already exists/i.test(message)) {
        console.log('skip', sql)
      } else {
        console.error('Falha:', sql)
        throw err
      }
    }
  }

  const cols = await client.execute('PRAGMA table_info(Profile)')
  const names = cols.rows.map((r) => String(r.name))
  console.log('Profile columns:', names.join(', '))
  console.log('deleted_at present:', names.includes('deleted_at'))
  client.close()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
