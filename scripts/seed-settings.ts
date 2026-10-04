/**
 * Insere apenas configurações padrão do sistema (sem perguntas, alunos ou certificados).
 */
import { createScriptPrisma } from './prisma-client'

const prisma = createScriptPrisma()

const defaultSettings = [
  {
    key: 'assessment.prova.question_count',
    value: '40',
    description: 'Número de questões (prova e simulado)',
  },
  {
    key: 'assessment.prova.time_limit_minutes',
    value: '120',
    description: 'Tempo limite em minutos (prova e simulado)',
  },
  {
    key: 'assessment.prova.passing_score',
    value: '70',
    description: 'Nota mínima para aprovação % (prova e simulado)',
  },
  { key: 'assessment.prova.retry_interval_hours', value: '24', description: 'Intervalo entre tentativas (horas)' },
  {
    key: 'assessment.prova.unlock_until',
    value: '""',
    description: 'ISO até quando a prova oficial pode ser iniciada (vazio = bloqueada)',
  },
  // Espelho do simulado — mantido em sync com assessment.prova.*
  {
    key: 'assessment.simulado.question_count',
    value: '40',
    description: 'Espelho: questões (mesmo valor da prova)',
  },
  {
    key: 'assessment.simulado.time_limit_minutes',
    value: '120',
    description: 'Espelho: tempo limite (mesmo valor da prova)',
  },
  {
    key: 'assessment.simulado.passing_score',
    value: '70',
    description: 'Espelho: nota mínima (mesmo valor da prova)',
  },
  { key: 'platform.name', value: '"Plataforma de Avaliação"', description: 'Nome da plataforma' },
  { key: 'platform.course_name', value: '"Informática Básica"', description: 'Nome do curso' },
  { key: 'platform.institution', value: '"Núcleo Assistencial Anita Briza"', description: 'Nome da instituição' },
  { key: 'platform.logo_url', value: '"/logo.jpg"', description: 'URL do logo da plataforma' },
  { key: 'certificate.title', value: '"CERTIFICADO"', description: 'Título do certificado' },
  {
    key: 'certificate.subtitle',
    value: '"DE CONCLUSÃO DE CURSO"',
    description: 'Subtítulo do certificado',
  },
  {
    key: 'certificate.intro_text',
    value: '"O {institution} certifica que"',
    description: 'Texto introdutório do certificado (antes do nome)',
  },
  {
    key: 'certificate.middle_text',
    value: '"concluiu com aproveitamento o curso de"',
    description: 'Texto entre o nome e o curso',
  },
  { key: 'certificate.course_hours', value: '40', description: 'Carga horária do curso (horas)' },
  {
    key: 'certificate.course_description',
    value:
      '"com carga horária de {course_hours} horas, desenvolvendo conhecimentos e habilidades para o uso do computador no dia a dia, incluindo sistema operacional, editor de textos, planilhas, internet e comunicação digital."',
    description: 'Descrição do curso no certificado',
  },
  { key: 'certificate.location', value: '"São Paulo"', description: 'Cidade no rodapé do certificado' },
  {
    key: 'certificate.date_line',
    value: '"{location}, {date}"',
    description: 'Linha de local e data do certificado',
  },
  {
    key: 'certificate.date_label',
    value: '"LOCAL E DATA"',
    description: 'Rótulo abaixo da data no certificado',
  },
  {
    key: 'certificate.signature_title',
    value: '"Coordenação"',
    description: 'Título da assinatura no certificado',
  },
  {
    key: 'certificate.signature_subtitle',
    value: '"Núcleo Assistencial Anita Briza"',
    description: 'Subtítulo da assinatura no certificado',
  },
  {
    key: 'certificate.code_label',
    value: '"Código: {certificate_code}"',
    description: 'Rótulo do código no certificado',
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
