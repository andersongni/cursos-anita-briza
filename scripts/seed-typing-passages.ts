/**
 * Insere textos padrão do exercício de digitação.
 *
 * Local:  npm run seed:typing
 * Remoto: npm run seed:typing:remote  (usa .env.production.local / Turso)
 */
import { loadScriptEnv } from './load-env'

const remote = process.argv.includes('--remote')
loadScriptEnv({ production: remote })

async function main() {
  const { createScriptPrisma } = await import('./prisma-client')
  const { DEFAULT_TYPING_PASSAGES } = await import('../src/lib/exercises/default-typing-passages')

  const url =
    process.env.DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.PROD_TURSO_DATABASE_URL ||
    'file:./prisma/dev.db'

  console.log(`[seed:typing] banco: ${url.startsWith('file:') ? 'sqlite local' : url}`)

  const prisma = createScriptPrisma()
  let created = 0
  let reactivated = 0
  let skipped = 0

  try {
    for (const passage of DEFAULT_TYPING_PASSAGES) {
      const existing = await prisma.typingPassage.findFirst({
        where: { title: passage.title },
        select: { id: true, active: true },
      })

      if (!existing) {
        await prisma.typingPassage.create({
          data: {
            title: passage.title,
            content: passage.content,
            active: true,
          },
        })
        created++
        continue
      }

      if (!existing.active) {
        await prisma.typingPassage.update({
          where: { id: existing.id },
          data: { active: true },
        })
        reactivated++
        continue
      }

      skipped++
    }

    const all = await prisma.typingPassage.findMany({
      select: { title: true, active: true },
      orderBy: { title: 'asc' },
    })

    console.log(
      `[seed:typing] criados: ${created} | reativados: ${reactivated} | já ok: ${skipped}`
    )
    console.log(`[seed:typing] total no banco: ${all.length}`)
    for (const row of all) {
      console.log(`  - ${row.active ? '✓' : '·'} ${row.title}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('[seed:typing] FALHA:', e instanceof Error ? e.message : e)
  process.exit(1)
})
