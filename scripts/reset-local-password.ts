/**
 * Redefine a senha de um usuário no banco local (ou no DATABASE_URL atual).
 * Uso: npx tsx scripts/reset-local-password.ts <username> <novaSenha>
 */
import bcrypt from 'bcryptjs'
import { createScriptPrisma } from './prisma-client'

async function main() {
  const username = (process.argv[2] || '').toLowerCase().trim()
  const password = process.argv[3] || ''

  if (!username || password.length < 6) {
    console.error('Uso: npx tsx scripts/reset-local-password.ts <username> <novaSenha>')
    console.error('A senha deve ter pelo menos 6 caracteres.')
    process.exit(1)
  }

  const url = process.env.DATABASE_URL || 'file:./prisma/dev.db'
  console.log('DB:', url.startsWith('file:') ? url : 'remote')

  const prisma = createScriptPrisma()
  try {
    const user = await prisma.profile.findUnique({ where: { username } })
    if (!user) {
      console.error(`Usuário "${username}" não encontrado.`)
      process.exit(1)
    }

    const password_hash = await bcrypt.hash(password, 12)
    await prisma.profile.update({
      where: { id: user.id },
      data: {
        password_hash,
        must_change_password: false,
        session_version: { increment: 1 },
      },
    })

    console.log(`Senha redefinida para "${username}".`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
