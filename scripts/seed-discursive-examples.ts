import { createScriptPrisma } from './prisma-client'
import { ensureCourses } from '../src/lib/courses/ensure-courses'
import { INFORMATICA_DISCURSIVE_QUESTIONS } from '../src/lib/assessment/discursive-informatica'

const prisma = createScriptPrisma()

async function main() {
  const { informaticaId } = await ensureCourses()
  const dim = await prisma.dimension.findFirst({
    where: { course_id: informaticaId, name: 'Fundamentos do computador' },
  })
  if (!dim) {
    throw new Error('Tema "Fundamentos do computador" não encontrado')
  }

  let created = 0
  let updated = 0

  for (const type of ['PROVA', 'SIMULADO'] as const) {
    for (const ex of INFORMATICA_DISCURSIVE_QUESTIONS) {
      const texts = [ex.question_text, ...ex.legacyTexts]
      const existing = await prisma.question.findFirst({
        where: {
          course_id: informaticaId,
          type,
          format: 'DISCURSIVE',
          question_text: { in: [...texts] },
        },
      })
      if (existing) {
        await prisma.question.update({
          where: { id: existing.id },
          data: {
            question_text: ex.question_text,
            expected_answer: ex.expected_answer,
            dimension_id: dim.id,
            active: true,
          },
        })
        updated++
        console.log(`Atualizada (${type}): ${ex.question_text}`)
        continue
      }
      await prisma.question.create({
        data: {
          course_id: informaticaId,
          type,
          format: 'DISCURSIVE',
          dimension_id: dim.id,
          question_text: ex.question_text,
          expected_answer: ex.expected_answer,
          active: true,
        },
      })
      created++
      console.log(`Criada (${type}): ${ex.question_text}`)
    }
  }
  console.log(`Concluído. Criadas: ${created}, atualizadas: ${updated}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
