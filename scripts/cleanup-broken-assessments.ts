/**
 * Remove avaliações vazias/quebradas e marca como expiradas as IN_PROGRESS com prazo vencido.
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const adapter = new PrismaLibSql({ url: process.env.DATABASE_URL ?? 'file:./prisma/dev.db' })
const prisma = new PrismaClient({ adapter })

async function main() {
  const all = await prisma.assessment.findMany({
    include: { _count: { select: { questions: true } } },
  })

  let deleted = 0
  let expired = 0

  for (const a of all) {
    const empty = a._count.questions === 0 || a.total_questions === 0
    if (empty) {
      await prisma.assessmentAnswer.deleteMany({ where: { assessment_id: a.id } })
      await prisma.assessmentQuestion.deleteMany({ where: { assessment_id: a.id } })
      await prisma.certificate.deleteMany({ where: { assessment_id: a.id } })
      await prisma.assessment.delete({ where: { id: a.id } })
      deleted++
      continue
    }

    if (
      a.status === 'IN_PROGRESS' &&
      a.deadline_at &&
      new Date() > new Date(a.deadline_at)
    ) {
      await prisma.assessment.update({
        where: { id: a.id },
        data: { status: 'EXPIRED' },
      })
      expired++
    }
  }

  // Garante banco de perguntas
  const simuladoQs = await prisma.question.count({
    where: { type: 'SIMULADO', active: true },
  })
  console.log({ deleted, expired, simuladoQuestions: simuladoQs })
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
