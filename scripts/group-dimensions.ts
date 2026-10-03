/**
 * Agrupa os temas finos em 6 temas principais e redistribui as perguntas.
 * Uso: npm run db:group-dimensions
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'
import { DIMENSION_GROUP_MAP, GROUP_META } from './dimension-groups'

const adapter = new PrismaLibSql({
  url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db',
})
const prisma = new PrismaClient({ adapter })

async function main() {
  const existing = await prisma.dimension.findMany()
  console.log(`Temas atuais: ${existing.length}`)

  const groupIds = new Map<string, string>()

  for (const [name, meta] of Object.entries(GROUP_META)) {
    let dim = existing.find((d) => d.name === name)
    if (!dim) {
      dim = await prisma.dimension.create({
        data: {
          name,
          description: meta.description,
          weight: meta.weight,
          target_percentage: meta.target_percentage,
          display_order: meta.display_order,
          active: true,
        },
      })
      console.log(`+ criado: ${name}`)
    } else {
      dim = await prisma.dimension.update({
        where: { id: dim.id },
        data: {
          description: meta.description,
          weight: meta.weight,
          target_percentage: meta.target_percentage,
          display_order: meta.display_order,
          active: true,
        },
      })
      console.log(`~ atualizado: ${name}`)
    }
    groupIds.set(name, dim.id)
  }

  const all = await prisma.dimension.findMany()
  let moved = 0

  for (const dim of all) {
    const groupName = DIMENSION_GROUP_MAP[dim.name]
    if (!groupName) {
      if (!GROUP_META[dim.name]) {
        console.warn(`? sem mapeamento: ${dim.name}`)
      }
      continue
    }

    const targetId = groupIds.get(groupName)!
    if (dim.id === targetId) continue

    const result = await prisma.question.updateMany({
      where: { dimension_id: dim.id },
      data: { dimension_id: targetId },
    })
    moved += result.count

    await prisma.assessmentQuestion.updateMany({
      where: { dimension_id: dim.id },
      data: {
        dimension_id: targetId,
        dimension_name_snapshot: groupName,
      },
    })

    await prisma.dimension.delete({ where: { id: dim.id } })
    console.log(`→ ${dim.name} → ${groupName} (${result.count} perguntas)`)
  }

  const final = await prisma.dimension.findMany({
    include: { _count: { select: { questions: true } } },
    orderBy: { display_order: 'asc' },
  })

  console.log('\nTemas finais:')
  for (const d of final) {
    console.log(
      `  ${d.display_order}. ${d.name} — ${d._count.questions} perguntas (${d.target_percentage}%)`
    )
  }
  console.log(`Perguntas movidas: ${moved}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
