/**
 * Insere apenas configurações padrão do sistema (sem perguntas, alunos ou certificados).
 */
import { PrismaClient } from '@prisma/client'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const dbUrl = process.env.DATABASE_URL ?? 'file:./prisma/dev.db'
const adapter = new PrismaLibSql({ url: dbUrl })
const prisma = new PrismaClient({ adapter })

const defaultSettings = [
  { key: 'assessment.prova.question_count', value: '40', description: 'Número de questões por prova' },
  { key: 'assessment.prova.time_limit_minutes', value: '120', description: 'Tempo limite em minutos' },
  { key: 'assessment.prova.passing_score', value: '70', description: 'Nota mínima para aprovação (%)' },
  { key: 'assessment.prova.retry_interval_hours', value: '24', description: 'Intervalo entre tentativas (horas)' },
  { key: 'assessment.simulado.question_count', value: '40', description: 'Número de questões por simulado' },
  { key: 'assessment.simulado.time_limit_minutes', value: '120', description: 'Tempo limite em minutos' },
  { key: 'assessment.simulado.passing_score', value: '70', description: 'Nota mínima (%)' },
  { key: 'platform.name', value: '"Plataforma de Avaliação"', description: 'Nome da plataforma' },
  { key: 'platform.course_name', value: '"Informática para Iniciantes"', description: 'Nome do curso' },
  { key: 'platform.institution', value: '"Núcleo Assistencial Anita Briza"', description: 'Nome da instituição' },
  { key: 'platform.logo_url', value: '"/logo.jpg"', description: 'URL do logo da plataforma' },
  {
    key: 'certificate.template_text',
    value:
      '"Certificamos que {student_name} concluiu com êxito o curso de {course_name}, realizado pelo {institution}, obtendo aprovação na avaliação final."',
    description: 'Texto base do certificado',
  },
]

async function main() {
  console.log('Seeding system settings...')
  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s,
    })
  }
  console.log(`OK — ${defaultSettings.length} configurações.`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
