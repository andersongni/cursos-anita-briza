import path from 'node:path'
import { defineConfig } from 'prisma/config'

// URL relativa — evita falha de caminho absoluto no Windows (os error 161)
const dbUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'

export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: dbUrl,
  },
})
