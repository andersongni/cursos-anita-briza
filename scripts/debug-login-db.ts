/**
 * Diagnóstico local: qual DB, quais usuários, se o hash bcrypt parece válido.
 * Não imprime senhas nem hashes completos.
 */
import { createScriptPrisma } from './prisma-client'
import { existsSync } from 'node:fs'
import path from 'node:path'

async function main() {
  const url =
    process.env.DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.PROD_TURSO_DATABASE_URL ||
    'file:./prisma/dev.db'

  console.log('DATABASE_URL kind:', url.startsWith('file:') ? 'file' : url.startsWith('libsql:') ? 'libsql' : 'other')
  console.log('TURSO token set:', Boolean(process.env.TURSO_AUTH_TOKEN || process.env.PROD_TURSO_AUTH_TOKEN))

  if (url.startsWith('file:')) {
    const dbPath = path.resolve(url.replace(/^file:/, ''))
    console.log('SQLite path:', dbPath)
    console.log('SQLite exists:', existsSync(dbPath))
  }

  const prisma = createScriptPrisma()
  try {
    const users = await prisma.profile.findMany({
      select: {
        username: true,
        role: true,
        status: true,
        password_hash: true,
        must_change_password: true,
      },
      orderBy: { username: 'asc' },
    })
    console.log('Profiles:', users.length)
    for (const u of users) {
      const hash = u.password_hash || ''
      console.log(
        `- ${u.username} | ${u.role} | ${u.status} | hash=${hash.startsWith('$2') ? 'bcrypt' : 'unknown'}(${hash.length}) | mustChange=${Boolean(u.must_change_password)}`
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
