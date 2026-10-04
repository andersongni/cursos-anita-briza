import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { getDatabaseAuthToken, getDatabaseUrl } from '@/lib/db-url'
import { ensureSchemaColumns } from '@/lib/ensure-schema'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient
  schemaEnsure?: Promise<unknown>
}

function createPrismaClient() {
  const url = getDatabaseUrl()
  const authToken = getDatabaseAuthToken()

  if (process.env.NODE_ENV === 'development') {
    const label = url.startsWith('file:')
      ? `sqlite:${url.replace(/^file:/, '')}`
      : `turso:${url.replace(/^libsql:\/\//, '').split('/')[0]}`
    console.info(`[db] using ${label}`)
  }

  // Garante colunas novas antes do primeiro uso (serverless cold start)
  if (!globalForPrisma.schemaEnsure) {
    globalForPrisma.schemaEnsure = ensureSchemaColumns().catch((err) => {
      console.error('[db] ensureSchemaColumns failed:', err instanceof Error ? err.message : err)
    })
  }

  const adapter = new PrismaLibSql(authToken ? { url, authToken } : { url })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export default prisma
