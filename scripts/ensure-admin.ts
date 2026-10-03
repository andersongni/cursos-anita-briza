/**
 * Garante um admin local para desenvolvimento offline.
 * Uso: npx tsx scripts/ensure-admin.ts
 * Env opcional: ADMIN_USERNAME, ADMIN_PASSWORD, ADMIN_FULL_NAME
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import bcrypt from 'bcryptjs'

const dbUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
const adapter = new PrismaLibSql({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

function formatName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((w) => {
      const lower = w.toLocaleLowerCase('pt-BR')
      return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1)
    })
    .join(' ')
}

async function main() {
  const username = (process.env.ADMIN_USERNAME ?? 'admin').toLowerCase().trim()
  const password = process.env.ADMIN_PASSWORD ?? 'admin123'
  const fullName = formatName(process.env.ADMIN_FULL_NAME ?? 'Administrador')

  const existing = await prisma.profile.findFirst({
    where: { role: 'ADMIN' },
  })

  if (existing) {
    console.log(`Admin já existe: ${existing.username}`)
    return
  }

  const hashedPassword = await bcrypt.hash(password, 12)
  const admin = await prisma.profile.create({
    data: {
      username,
      full_name: fullName,
      password_hash: hashedPassword,
      role: 'ADMIN',
      status: 'APPROVED',
      must_change_password: true,
    },
  })

  console.log('Admin de desenvolvimento criado:')
  console.log(`  usuário: ${admin.username}`)
  console.log(`  senha:   ${password}`)
}

main()
  .catch((e) => {
    console.error('Erro:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
