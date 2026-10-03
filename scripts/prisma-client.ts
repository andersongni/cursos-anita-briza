import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

/** Cliente Prisma para scripts — aceita SQLite local ou Turso. */
export function createScriptPrisma() {
  const url =
    process.env.DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.PROD_TURSO_DATABASE_URL ||
    'file:./prisma/dev.db'
  const authToken =
    process.env.TURSO_AUTH_TOKEN ||
    process.env.DATABASE_AUTH_TOKEN ||
    process.env.PROD_TURSO_AUTH_TOKEN
  const adapter = new PrismaLibSql(
    authToken && !url.startsWith('file:') ? { url, authToken } : { url }
  )
  return new PrismaClient({ adapter })
}
