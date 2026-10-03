import path from 'node:path'
import { defineConfig } from 'prisma/config'

/**
 * O CLI do Prisma (db push / migrate) só aceita `file:` para provider sqlite.
 * URLs Turso (`libsql://`) são usadas em runtime via @prisma/adapter-libsql.
 */
const raw = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
const dbUrl =
  raw.startsWith('libsql:') || raw.startsWith('https:')
    ? 'file:./prisma/dev.db'
    : raw

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: dbUrl,
  },
})
