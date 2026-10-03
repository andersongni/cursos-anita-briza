import { createClient } from '@libsql/client'
import { createScriptPrisma } from './prisma-client'

async function main() {
  const url =
    process.env.DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.PROD_TURSO_DATABASE_URL
  const authToken =
    process.env.TURSO_AUTH_TOKEN ||
    process.env.DATABASE_AUTH_TOKEN ||
    process.env.PROD_TURSO_AUTH_TOKEN

  console.log('URL host:', url?.replace(/^libsql:\/\//, '').slice(0, 60))
  console.log('Token set:', Boolean(authToken))

  if (!url || !authToken) {
    console.error('Faltam DATABASE_URL / TURSO_AUTH_TOKEN')
    process.exit(1)
  }

  const client = createClient({ url, authToken })
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
  )
  console.log(
    'sqlite_master tables:',
    tables.rows.map((r) => String(r.name)).join(', ') || '(none)'
  )

  try {
    const n = await client.execute('SELECT COUNT(*) AS c FROM SystemSetting')
    console.log('SystemSetting count (raw):', n.rows[0]?.c)
  } catch (e) {
    console.error('SystemSetting raw query failed:', e instanceof Error ? e.message : e)
  }
  client.close()

  const prisma = createScriptPrisma()
  try {
    const count = await prisma.systemSetting.count()
    console.log('SystemSetting count (prisma):', count)
  } catch (e) {
    console.error('Prisma SystemSetting failed:', e instanceof Error ? e.message : e)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
