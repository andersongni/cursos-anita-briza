import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { getDatabaseAuthToken, getDatabaseUrl } from '@/lib/db-url'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

function createPrismaClient() {
  const url = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()
  const adapter = new PrismaLibSql(
    authToken ? { url, authToken } : { url }
  )
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
