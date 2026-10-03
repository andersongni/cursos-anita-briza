/**
 * Garante SQLite local no `npm run dev`, mesmo se o terminal
 * ainda tiver DATABASE_URL/TURSO_* de um setup remoto anterior.
 */
import { spawn } from 'node:child_process'

const env = { ...process.env }

// Força banco arquivo local para desenvolvimento
env.DATABASE_URL = 'file:./prisma/dev.db'
delete env.TURSO_AUTH_TOKEN
delete env.TURSO_DATABASE_URL
delete env.DATABASE_AUTH_TOKEN
delete env.PROD_TURSO_AUTH_TOKEN
delete env.PROD_TURSO_DATABASE_URL

console.log('[dev] DATABASE_URL=file:./prisma/dev.db (SQLite local)')

const child = spawn('npx', ['next', 'dev'], {
  stdio: 'inherit',
  shell: true,
  env,
})

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  process.exit(code ?? 1)
})
