import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { createScriptPrisma } from './prisma-client'
import { ensureCourses } from '../src/lib/courses/ensure-courses'
import { ELETRICA_DIMENSIONS } from '../src/lib/courses/constants'

const prisma = createScriptPrisma()

type OptionJson = {
  key: string
  text: string
  is_correct: boolean
  explanation?: string
}

type QuestionJson = {
  dimension: string
  question_text: string
  options: OptionJson[]
}

async function main() {
  console.log('Seeding perguntas de Elétrica Básica...')
  const { eletricaId } = await ensureCourses()

  // Garante temas
  const dims = await prisma.dimension.findMany({
    where: { course_id: eletricaId },
  })
  const dimByName = new Map(dims.map((d) => [d.name, d.id]))

  for (const meta of ELETRICA_DIMENSIONS) {
    if (!dimByName.has(meta.name)) {
      const created = await prisma.dimension.create({
        data: {
          course_id: eletricaId,
          name: meta.name,
          description: meta.description,
          target_percentage: meta.target_percentage,
          display_order: meta.display_order,
          weight: 1,
          active: true,
        },
      })
      dimByName.set(created.name, created.id)
    }
  }

  const filePath = path.join(__dirname, '..', 'data', 'questions', 'eletrica_basica.json')
  const raw = await fs.readFile(filePath, 'utf-8')
  const questions: QuestionJson[] = JSON.parse(raw)

  let inserted = 0
  let skipped = 0

  for (const q of questions) {
    const dimensionId = dimByName.get(q.dimension)
    if (!dimensionId) {
      console.warn(`Tema não encontrado: ${q.dimension}`)
      continue
    }

    if (!Array.isArray(q.options) || q.options.length !== 5) {
      console.warn(`Pergunta inválida (precisa de 5 opções): ${q.question_text}`)
      continue
    }
    if (q.options.filter((o) => o.is_correct).length !== 1) {
      console.warn(`Pergunta inválida (1 correta): ${q.question_text}`)
      continue
    }

    for (const type of ['PROVA', 'SIMULADO'] as const) {
      const existing = await prisma.question.findFirst({
        where: {
          course_id: eletricaId,
          type,
          question_text: q.question_text,
        },
      })
      if (existing) {
        skipped++
        continue
      }

      await prisma.question.create({
        data: {
          course_id: eletricaId,
          type,
          dimension_id: dimensionId,
          question_text: q.question_text,
          active: true,
          options: {
            create: q.options.map((o) => ({
              option_key: o.key,
              option_text: o.text,
              is_correct: o.is_correct,
              explanation: o.explanation ?? '',
            })),
          },
        },
      })
      inserted++
    }
  }

  console.log(
    `Elétrica: ${inserted} perguntas inseridas (PROVA+SIMULADO), ${skipped} já existiam.`
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
