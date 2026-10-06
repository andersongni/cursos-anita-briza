import { createScriptPrisma } from './prisma-client'
import { ensureCourses } from '../src/lib/courses/ensure-courses'

const prisma = createScriptPrisma()

async function main() {
  const { informaticaId } = await ensureCourses()
  const dim = await prisma.dimension.findFirst({
    where: { course_id: informaticaId, name: 'Fundamentos do computador' },
  })
  if (!dim) {
    throw new Error('Tema "Fundamentos do computador" não encontrado')
  }

  const examples = [
    {
      question_text: 'Cite dois exemplos de Hardware.',
      expected_answer:
        'Aceitar quaisquer dois exemplos de hardware, como: monitor, teclado, mouse, impressora, CPU, processador, HD, SSD, memória RAM, placa-mãe, webcam, microfone, caixa de som, pendrive.',
    },
    {
      question_text: 'Cite dois exemplos de Software.',
      expected_answer:
        'Aceitar quaisquer dois exemplos de software, incluindo programas e sites/plataformas web, como: Windows, Linux, Word, Excel, PowerPoint, Chrome, Firefox, WhatsApp, Paint, Bloco de Notas, antivírus, sistema operacional, aplicativo, programa, Gmail, YouTube, GitHub, Railway, Vercel.',
    },
  ]

  let created = 0
  for (const type of ['PROVA', 'SIMULADO'] as const) {
    for (const ex of examples) {
      const existing = await prisma.question.findFirst({
        where: {
          course_id: informaticaId,
          question_text: ex.question_text,
          type,
          format: 'DISCURSIVE',
        },
      })
      if (existing) {
        console.log(`Já existe (${type}): ${ex.question_text}`)
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
  console.log(`Concluído. Novas: ${created}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
