/**
 * Remove todos os dados de negócio, mantendo só settings e admin.
 * Uso: npx tsx scripts/clear-data.ts
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const dbUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
const adapter = new PrismaLibSql({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

async function main() {
  await prisma.assessmentAnswer.deleteMany()
  await prisma.assessmentQuestion.deleteMany()
  await prisma.certificate.deleteMany()
  await prisma.attemptRelease.deleteMany()
  await prisma.assessment.deleteMany()
  await prisma.auditLog.deleteMany()
  await prisma.questionOption.deleteMany()
  await prisma.question.deleteMany()
  await prisma.dimension.deleteMany()
  await prisma.profile.deleteMany({ where: { role: { not: 'ADMIN' } } })

  // Remove certificados/avaliações ligados ao admin (demo)
  const admins = await prisma.profile.findMany({ where: { role: 'ADMIN' } })
  for (const admin of admins) {
    await prisma.certificate.deleteMany({ where: { student_id: admin.id } })
    await prisma.assessmentAnswer.deleteMany({
      where: { assessment: { student_id: admin.id } },
    })
    await prisma.assessmentQuestion.deleteMany({
      where: { assessment: { student_id: admin.id } },
    })
    await prisma.assessment.deleteMany({ where: { student_id: admin.id } })
  }

  const counts = {
    profiles: await prisma.profile.count(),
    questions: await prisma.question.count(),
    assessments: await prisma.assessment.count(),
    certificates: await prisma.certificate.count(),
    dimensions: await prisma.dimension.count(),
    settings: await prisma.systemSetting.count(),
  }
  console.log('Banco limpo:', counts)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
