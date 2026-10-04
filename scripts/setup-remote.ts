/**
 * Inicializa schema + settings + admin no banco remoto (Turso).
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL="libsql://...."
 *   $env:TURSO_AUTH_TOKEN="...."
 *   npm run db:setup:remote
 */
import { execSync } from 'node:child_process'
import { createClient } from '@libsql/client'

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

process.env.DATABASE_URL = url
process.env.TURSO_AUTH_TOKEN = authToken

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((chunk) =>
      chunk
        .split('\n')
        .map((line) => line.trimEnd())
        // remove comentários de linha do Prisma (-- CreateTable etc.)
        .filter((line) => {
          const trimmed = line.trim()
          return trimmed.length > 0 && !trimmed.startsWith('--')
        })
        .join('\n')
        .trim()
    )
    .filter((statement) => statement.length > 0)
}

async function applySchema() {
  console.log('Gerando SQL do schema...')
  const sql = execSync(
    'npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script',
    {
      encoding: 'utf8',
      env: { ...process.env, DATABASE_URL: 'file:./prisma/dev.db' },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  ).trim()

  if (!sql) {
    console.error('Nenhum SQL gerado a partir do schema.')
    process.exit(1)
  }

  const statements = splitSqlStatements(sql)
  console.log(`Aplicando ${statements.length} statements no Turso...`)

  const client = createClient({ url, authToken })

  for (const statement of statements) {
    try {
      await client.execute(statement)
      const preview = statement.replace(/\s+/g, ' ').slice(0, 72)
      console.log(`  OK  ${preview}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (/already exists/i.test(message)) {
        const preview = statement.replace(/\s+/g, ' ').slice(0, 72)
        console.log(`  skip ${preview}`)
        continue
      }
      console.error('Falha ao executar:', statement.slice(0, 200))
      throw err
    }
  }

  // Migrações aditivas (mesma lista do deploy)
  const { SCHEMA_MIGRATIONS } = await import('../src/lib/schema-migrations')
  for (const migration of SCHEMA_MIGRATIONS) {
    try {
      await client.execute(migration.sql)
      console.log(`  OK  ${migration.id}`)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      if (/duplicate column|already exists|duplicate table/i.test(message)) {
        console.log(`  skip ${migration.id}`)
      } else {
        throw err
      }
    }
  }

  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  console.log(
    'Tabelas no Turso:',
    tables.rows.map((r) => r.name).join(', ')
  )
  client.close()
}

async function main() {
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
