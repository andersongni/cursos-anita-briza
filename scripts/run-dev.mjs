/**
 * Garante SQLite local no `npm run dev`, mesmo se o terminal
 * ainda tiver DATABASE_URL/TURSO_* de um setup remoto anterior.
 * Também regenera o Prisma Client e aplica o schema local para
 * evitar "Unknown argument" após mudanças no schema.prisma.
 */
import { spawn, execSync } from 'node:child_process'

const env = { ...process.env }

// Força banco arquivo local para desenvolvimento
env.DATABASE_URL = 'file:./prisma/dev.db'
delete env.TURSO_AUTH_TOKEN
delete env.TURSO_DATABASE_URL
delete env.DATABASE_AUTH_TOKEN
delete env.PROD_TURSO_AUTH_TOKEN
delete env.PROD_TURSO_DATABASE_URL

console.log('[dev] DATABASE_URL=file:./prisma/dev.db (SQLite local)')

try {
  console.log('[dev] prisma generate…')
  execSync('npx prisma generate', { stdio: 'inherit', env })
  console.log('[dev] prisma db push…')
  execSync('npx prisma db push', { stdio: 'inherit', env })
} catch (err) {
  console.error('[dev] falha ao sincronizar Prisma:', err instanceof Error ? err.message : err)
  process.exit(1)
}

const child = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
