/**
 * Inicializa schema + settings + admin no banco remoto (Turso).
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL="libsql://...."
 *   $env:TURSO_AUTH_TOKEN="...."
 *   npm run db:setup:remote
 *
 * Nota: `prisma db push` não aceita libsql:// — geramos o SQL e aplicamos
 * com @libsql/client.
 */
import { execSync } from 'node:child_process'
import { createClient } from '@libsql/client'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    console.error(`Falta a variável ${name}.`)
    process.exit(1)
  }
  return value
}

const url =
  process.env.DATABASE_URL ||
  process.env.TURSO_DATABASE_URL ||
  process.env.PROD_TURSO_DATABASE_URL

const authToken =
  process.env.TURSO_AUTH_TOKEN ||
  process.env.DATABASE_AUTH_TOKEN ||
  process.env.PROD_TURSO_AUTH_TOKEN

if (!url || url.startsWith('file:')) {
  console.error(
    'DATABASE_URL precisa ser a URL remota do Turso (libsql://...), não um arquivo local.'
  )
  process.exit(1)
}

if (!authToken) {
  console.error('Falta TURSO_AUTH_TOKEN.')
  process.exit(1)
}

// Garante que os seeds usem a URL remota
process.env.DATABASE_URL = url
process.env.TURSO_AUTH_TOKEN = authToken

async function applySchema() {
  console.log('Gerando SQL do schema...')
  // prisma.config força file: para o CLI; migrate diff só lê o schema
  const sql = execSync(
    'npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script',
    { encoding: 'utf8', env: { ...process.env, DATABASE_URL: 'file:./prisma/dev.db' } }
  ).trim()

  if (!sql) {
    console.error('Nenhum SQL gerado a partir do schema.')
    process.exit(1)
  }

  console.log('Aplicando schema no Turso...')
  const client = createClient({ url, authToken })

  // Executa statement a statement (libSQL não aceita multi-statement em batch simples)
  const statements = sql
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('--'))

  for (const statement of statements) {
    try {
      await client.execute(statement)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      // Idempotente: tabela/índice já existente
      if (/already exists/i.test(message)) {
        console.log(`  (já existe) ${statement.slice(0, 60)}...`)
        continue
      }
      console.error('Falha ao executar:', statement.slice(0, 120))
      throw err
    }
  }

  client.close()
  console.log('Schema aplicado.')
}

async function main() {
  requireEnv('TURSO_AUTH_TOKEN')
  await applySchema()

  console.log('Seed de configurações...')
  execSync('npm run seed:settings', { stdio: 'inherit', env: process.env })

  console.log('Garantindo admin...')
  execSync('npm run ensure-admin', { stdio: 'inherit', env: process.env })

  console.log('Seed de perguntas (pode demorar)...')
  execSync('npm run seed', { stdio: 'inherit', env: process.env })

  console.log('\nOK — banco remoto pronto. Faça login com admin / admin123 e troque a senha.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
