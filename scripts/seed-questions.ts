import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { GROUP_META, resolveDimensionGroup } from './dimension-groups'
import { createScriptPrisma } from './prisma-client'

const prisma = createScriptPrisma()


interface OptionJson {
  key: string;
  text: string;
  is_correct: boolean;
  explanation?: string;
}

interface QuestionJson {
  id: number;
  type: string;
  dimension: string;
  question_text: string;
  options: OptionJson[];
}

async function ensureGroupedDimensions(dimensionMap: Map<string, string>) {
  for (const [name, meta] of Object.entries(GROUP_META)) {
    if (dimensionMap.has(name)) {
      await prisma.dimension.update({
        where: { id: dimensionMap.get(name)! },
        data: {
          description: meta.description,
          weight: meta.weight,
          target_percentage: meta.target_percentage,
          display_order: meta.display_order,
          active: true,
        },
      })
      continue
    }
    const created = await prisma.dimension.create({
      data: {
        name,
        description: meta.description,
        weight: meta.weight,
        target_percentage: meta.target_percentage,
        display_order: meta.display_order,
        active: true,
      },
    })
    dimensionMap.set(name, created.id)
  }
}

async function main() {
  console.log('Starting seed process...');
  const dataDir = path.join(__dirname, '..', 'data', 'questions');
  const files = [
    'prova_part1.json',
    'prova_part2.json',
    'simulado_part1.json',
    'simulado_part2.json'
  ];

  // Load existing dimensions to map name -> id
  const dimensions = await prisma.dimension.findMany();
  const dimensionMap = new Map<string, string>();
  for (const dim of dimensions) {
    dimensionMap.set(dim.name, dim.id);
  }
  await ensureGroupedDimensions(dimensionMap);

  let totalProcessed = 0;

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const questions: QuestionJson[] = JSON.parse(fileContent);
      console.log(`Processing ${file} (${questions.length} questions)...`);

      for (const q of questions) {
        const dimensionName = resolveDimensionGroup(q.dimension);
        let dimensionId = dimensionMap.get(dimensionName);
        if (!dimensionId) {
          const meta = GROUP_META[dimensionName];
          const newDim = await prisma.dimension.create({
            data: {
              name: dimensionName,
              description: meta?.description,
              weight: meta?.weight ?? 1,
              target_percentage: meta?.target_percentage ?? 5.0,
              display_order: meta?.display_order ?? 99,
              active: true,
            }
          });
          dimensionId = newDim.id;
          dimensionMap.set(newDim.name, newDim.id);
        }

        // Check for duplicates
        const existingQuestion = await prisma.question.findFirst({
          where: {
            question_text: q.question_text,
            type: q.type as any,
          }
        });

        if (!existingQuestion) {
          await prisma.question.create({
            data: {
              type: q.type as any,
              dimension_id: dimensionId,
              question_text: q.question_text,
              options: {
                create: q.options.map(o => ({
                  option_key: o.key,
                  option_text: o.text,
                  is_correct: o.is_correct,
                  explanation: o.explanation,
                }))
              }
            }
          });
          totalProcessed++;

          if (totalProcessed % 50 === 0) {
            console.log(`Seeded ${totalProcessed} questions so far...`);
          }
        }
      }
    } catch (err) {
      console.warn(`Could not process file ${file}:`, err);
    }
  }

  console.log(`Finished seeding questions. Total new questions inserted: ${totalProcessed}`);

  console.log('Seeding System Settings...');
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
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s
    });
  }
  console.log('System Settings seeded successfully.');
}

main()
  .catch(e => {
    console.error('Error seeding data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
