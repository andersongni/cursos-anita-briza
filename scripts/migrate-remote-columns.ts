/**
 * Aplica migrações aditivas no Turso (manual).
 * Preferência: elas já rodam no `npm run build` via deploy-schema.ts.
 *
 * Uso: npm run db:migrate:remote
 */
import { readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { ensureSchemaColumns } from '../src/lib/ensure-schema'

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
    // Ignora placeholders do `vercel env pull` (secrets Hidden)
    if (value === '[SENSITIVE]' || value === 'SENSITIVE') continue
    if (override || !process.env[key]) {
      process.env[key] = value
    }
  }
}

loadEnvFile(resolve(process.cwd(), '.env.local'))
loadEnvFile(resolve(process.cwd(), '.env.production.local'), { override: true })

async function main() {
  const result = await ensureSchemaColumns()
  console.log('aplicadas:', result.applied.join(', ') || '(nenhuma)')
  console.log('já existiam:', result.skipped.join(', ') || '(nenhuma)')
  console.log('deleted_at:', result.deleted_at)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
