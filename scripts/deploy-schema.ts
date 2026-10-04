/**
 * Aplica migrações aditivas no banco do ambiente atual.
 * Rodado no `npm run build` (inclui deploy Vercel) para o Turso
 * receber colunas novas antes do app subir.
 *
 * Também garante os textos padrão do exercício de digitação.
 *
 * Local com SQLite: também aplica (idempotente).
 * Sem URL de banco válida: avisa e segue (não quebra build de preview sem env).
 */
import { ensureSchemaColumns } from '../src/lib/ensure-schema'
import { getDatabaseUrl } from '../src/lib/db-url'
import { ensureTypingPassagesSeeded } from '../src/lib/exercises/ensure-typing-passages'

function isRemote(url: string): boolean {
  return url.startsWith('libsql://') || url.startsWith('https://')
}

async function main() {
  let url: string
  try {
    url = getDatabaseUrl()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    // No Vercel sem DATABASE_URL: falha o build (produção quebraria de qualquer forma)
    if (process.env.VERCEL === '1') {
      console.error('[deploy-schema] DATABASE_URL obrigatória no Vercel:', message)
      process.exit(1)
    }
    console.warn('[deploy-schema] sem URL de banco — pulando migrações:', message)
    return
  }

  const target = isRemote(url)
    ? `turso:${url.replace(/^(libsql|https):\/\//, '').split('/')[0]}`
    : 'sqlite:local'

  console.log(`[deploy-schema] aplicando migrações em ${target}...`)

  try {
    const result = await ensureSchemaColumns()
    if (result.applied.length) {
      console.log('[deploy-schema] aplicadas:', result.applied.join(', '))
    }
    if (result.skipped.length) {
      console.log('[deploy-schema] já existiam:', result.skipped.join(', '))
    }
    console.log('[deploy-schema] Profile.deleted_at =', result.deleted_at)

    try {
      const seed = await ensureTypingPassagesSeeded({ force: true })
      console.log(
        `[deploy-schema] digitação: criados=${seed.created} reativados=${seed.reactivated} total=${seed.total}`
      )
    } catch (seedErr) {
      const seedMessage = seedErr instanceof Error ? seedErr.message : String(seedErr)
      console.warn('[deploy-schema] seed digitação falhou (não bloqueia):', seedMessage)
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[deploy-schema] FALHA:', message)
    // Em deploy Vercel, falhar o build evita publicar app incompatível com o banco
    if (process.env.VERCEL === '1' || isRemote(url)) {
      process.exit(1)
    }
    console.warn('[deploy-schema] continuando build local apesar da falha')
  }
}

main()
