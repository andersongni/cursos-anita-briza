/**
 * Inicializa schema + settings + admin no banco remoto (Turso).
 *
 * Uso (PowerShell):
 *   $env:DATABASE_URL="libsql://...."
 *   $env:TURSO_AUTH_TOKEN="...."
 *   npx tsx scripts/setup-remote.ts
 */
import { execSync } from 'node:child_process'

function requireEnv(name: string) {
  const value = process.env[name]
  if (!value) {
    console.error(`Falta a variável ${name}.`)
    process.exit(1)
  }
  return value
}

const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
if (!url || url.startsWith('file:')) {
  console.error(
    'DATABASE_URL precisa ser a URL remota do Turso (libsql://...), não um arquivo local.'
  )
  process.exit(1)
}

requireEnv('TURSO_AUTH_TOKEN')

console.log('Aplicando schema (prisma db push)...')
execSync('npx prisma db push', { stdio: 'inherit', env: process.env })

console.log('Seed de configurações...')
execSync('npm run seed:settings', { stdio: 'inherit', env: process.env })

console.log('Garantindo admin...')
execSync('npm run ensure-admin', { stdio: 'inherit', env: process.env })

console.log('Seed de perguntas (pode demorar)...')
execSync('npm run seed', { stdio: 'inherit', env: process.env })

console.log('\nOK — banco remoto pronto. Faça login com admin / admin123 e troque a senha.')
