import bcrypt from 'bcryptjs'
import { createClient } from '@libsql/client'
import path from 'node:path'

async function main() {
  const username = (process.argv[2] || '').toLowerCase().trim()
  const password = process.argv[3] || ''
  if (!username || !password) {
    console.error('Uso: npx tsx scripts/verify-password.ts <username> <password>')
    process.exit(1)
  }

  const abs = path.resolve('prisma/dev.db')
  const urls = [`file:./prisma/dev.db`, `file:${abs}`, pathToFileUrl(abs)]

  for (const url of urls) {
    const client = createClient({ url })
    try {
      const rs = await client.execute({
        sql: 'SELECT password_hash FROM Profile WHERE username = ?',
        args: [username],
      })
      const hash = String(rs.rows[0]?.password_hash ?? '')
      const ok = hash ? await bcrypt.compare(password, hash) : false
      console.log(url)
      console.log('  hashPrefix:', hash.slice(0, 10), 'len:', hash.length, 'match:', ok)
    } catch (e) {
      console.log(url, 'ERROR', e instanceof Error ? e.message : e)
    } finally {
      client.close()
    }
  }
}

function pathToFileUrl(p: string) {
  const normalized = p.replace(/\\/g, '/')
  return normalized.startsWith('/') ? `file://${normalized}` : `file:///${normalized}`
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
