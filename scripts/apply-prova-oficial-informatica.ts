/**
 * Reorganiza o banco de Informática Básica:
 * - Move todas as MC de PROVA → SIMULADO (ou desativa se já existir no simulado)
 * - Mantém as 2 discursivas de PROVA
 * - Cadastra as 8 MC oficiais da prova (PDF) com 5 alternativas
 * - Ajusta settings do curso: 8 de múltipla escolha + 2 discursivas
 *
 * Local:  npx tsx scripts/apply-prova-oficial-informatica.ts
 * Remoto: npx tsx scripts/apply-prova-oficial-informatica.ts --remote
 */
import { loadScriptEnv } from './load-env'
import { GROUP_META } from './dimension-groups'

const remote = process.argv.includes('--remote')
loadScriptEnv({ production: remote })

async function main() {
  const { createScriptPrisma } = await import('./prisma-client')
  const { ensureCourses } = await import('../src/lib/courses/ensure-courses')
  const { PROVA_OFICIAL_MC_QUESTIONS } = await import(
    '../src/lib/assessment/prova-oficial-informatica'
  )
  const { assessmentCourseSettingKey } = await import('../src/lib/settings/assessment')
  const { INFORMATICA_DISCURSIVE_QUESTIONS } = await import(
    '../src/lib/assessment/discursive-informatica'
  )

  const url =
    process.env.DATABASE_URL ||
    process.env.TURSO_DATABASE_URL ||
    process.env.PROD_TURSO_DATABASE_URL ||
    'file:./prisma/dev.db'
  if (remote && (url.startsWith('file:') || !url)) {
    throw new Error(
      '--remote exige DATABASE_URL/PROD_TURSO_DATABASE_URL real em .env.production.local (valores [SENSITIVE] são ignorados).'
    )
  }
  console.log(
    `[prova-oficial] banco: ${url.startsWith('file:') ? 'sqlite local' : url.slice(0, 40) + '…'}`
  )

  const prisma = createScriptPrisma()

  try {
    const { informaticaId } = await ensureCourses()

    // Garante temas usados pelas questões oficiais
    const dims = await prisma.dimension.findMany({
      where: { course_id: informaticaId },
      select: { id: true, name: true },
    })
    const dimMap = new Map(dims.map((d) => [d.name, d.id]))
    for (const name of new Set(PROVA_OFICIAL_MC_QUESTIONS.map((q) => q.dimension))) {
      if (dimMap.has(name)) continue
      const meta = GROUP_META[name]
      const created = await prisma.dimension.create({
        data: {
          course_id: informaticaId,
          name,
          description: meta?.description,
          weight: meta?.weight ?? 1,
          target_percentage: meta?.target_percentage ?? 5,
          display_order: meta?.display_order ?? 99,
          active: true,
        },
      })
      dimMap.set(name, created.id)
      console.log(`[prova-oficial] tema criado: ${name}`)
    }

    const officialMcTexts = new Set(
      PROVA_OFICIAL_MC_QUESTIONS.map((q) => q.question_text)
    )

    // 1) Mover MC de PROVA → SIMULADO (exceto as 8 oficiais)
    const provaMc = await prisma.question.findMany({
      where: {
        course_id: informaticaId,
        type: 'PROVA',
        format: 'MULTIPLE_CHOICE',
      },
      select: { id: true, question_text: true, active: true },
    })

    let moved = 0
    let deactivatedDup = 0
    let skippedOfficial = 0
    for (const q of provaMc) {
      if (officialMcTexts.has(q.question_text)) {
        skippedOfficial++
        continue
      }
      const alreadySimulado = await prisma.question.findFirst({
        where: {
          course_id: informaticaId,
          type: 'SIMULADO',
          format: 'MULTIPLE_CHOICE',
          question_text: q.question_text,
        },
        select: { id: true },
      })
      if (alreadySimulado) {
        if (q.active) {
          await prisma.question.update({
            where: { id: q.id },
            data: { active: false },
          })
          deactivatedDup++
        }
        continue
      }
      await prisma.question.update({
        where: { id: q.id },
        data: { type: 'SIMULADO', active: true },
      })
      moved++
    }
    console.log(
      `[prova-oficial] MC PROVA→SIMULADO: movidas=${moved} desativadas(duplicata)=${deactivatedDup} oficiais_preservadas=${skippedOfficial}`
    )

    // 2) Garantir exatamente as 2 discursivas oficiais ativas em PROVA
    const fundamentosId = dimMap.get('Fundamentos do computador')
    if (!fundamentosId) {
      throw new Error('Tema "Fundamentos do computador" não encontrado')
    }
    const officialDiscIds: string[] = []
    for (const ex of INFORMATICA_DISCURSIVE_QUESTIONS) {
      const texts = [ex.question_text, ...ex.legacyTexts]
      // Match também por prefixo curto (ex.: "Cite dois exemplos de hardware")
      const short = ex.question_text.split('.')[0]?.trim().toLowerCase()
      const allProvaDisc = await prisma.question.findMany({
        where: {
          course_id: informaticaId,
          type: 'PROVA',
          format: 'DISCURSIVE',
        },
      })
      const existing =
        allProvaDisc.find((q) => texts.includes(q.question_text)) ||
        allProvaDisc.find((q) =>
          short ? q.question_text.trim().toLowerCase().startsWith(short) : false
        )

      if (existing) {
        await prisma.question.update({
          where: { id: existing.id },
          data: {
            question_text: ex.question_text,
            expected_answer: ex.expected_answer,
            dimension_id: fundamentosId,
            active: true,
          },
        })
        officialDiscIds.push(existing.id)
        console.log(`[prova-oficial] discursiva OK: ${ex.question_text.slice(0, 48)}…`)
      } else {
        const created = await prisma.question.create({
          data: {
            course_id: informaticaId,
            type: 'PROVA',
            format: 'DISCURSIVE',
            dimension_id: fundamentosId,
            question_text: ex.question_text,
            expected_answer: ex.expected_answer,
            active: true,
          },
        })
        officialDiscIds.push(created.id)
        console.log(`[prova-oficial] discursiva criada: ${ex.question_text.slice(0, 48)}…`)
      }
    }

    const extraDisc = await prisma.question.updateMany({
      where: {
        course_id: informaticaId,
        type: 'PROVA',
        format: 'DISCURSIVE',
        id: { notIn: officialDiscIds },
        active: true,
      },
      data: { active: false },
    })
    if (extraDisc.count > 0) {
      console.log(
        `[prova-oficial] discursivas extras desativadas em PROVA: ${extraDisc.count}`
      )
    }

    // 3) Upsert das 8 MC oficiais de PROVA (e limpa cópias no SIMULADO)
    let created = 0
    let updated = 0
    const officialMcIds: string[] = []
    for (const q of PROVA_OFICIAL_MC_QUESTIONS) {
      const dimId = dimMap.get(q.dimension)
      if (!dimId) throw new Error(`Tema ausente: ${q.dimension}`)

      // Preferir registro já em PROVA; senão recuperar do SIMULADO
      let existing = await prisma.question.findFirst({
        where: {
          course_id: informaticaId,
          type: 'PROVA',
          format: 'MULTIPLE_CHOICE',
          question_text: q.question_text,
        },
        select: { id: true },
      })
      if (!existing) {
        existing = await prisma.question.findFirst({
          where: {
            course_id: informaticaId,
            type: 'SIMULADO',
            format: 'MULTIPLE_CHOICE',
            question_text: q.question_text,
          },
          select: { id: true },
        })
      }

      if (existing) {
        await prisma.$transaction(async (tx) => {
          await tx.questionOption.deleteMany({ where: { question_id: existing.id } })
          await tx.question.update({
            where: { id: existing.id },
            data: {
              type: 'PROVA',
              dimension_id: dimId,
              active: true,
              options: {
                create: q.options.map((o) => ({
                  option_key: o.key,
                  option_text: o.text,
                  is_correct: o.is_correct,
                  explanation: o.explanation,
                })),
              },
            },
          })
        })
        officialMcIds.push(existing.id)
        updated++
      } else {
        const createdQ = await prisma.question.create({
          data: {
            course_id: informaticaId,
            type: 'PROVA',
            format: 'MULTIPLE_CHOICE',
            dimension_id: dimId,
            question_text: q.question_text,
            active: true,
            options: {
              create: q.options.map((o) => ({
                option_key: o.key,
                option_text: o.text,
                is_correct: o.is_correct,
                explanation: o.explanation,
              })),
            },
          },
        })
        officialMcIds.push(createdQ.id)
        created++
      }

      // Desativar outras cópias (SIMULADO ou PROVA duplicada) do mesmo enunciado
      await prisma.question.updateMany({
        where: {
          course_id: informaticaId,
          format: 'MULTIPLE_CHOICE',
          question_text: q.question_text,
          id: { notIn: officialMcIds.slice(-1) },
          active: true,
        },
        data: { active: false },
      })
    }

    // Desativar qualquer MC ativa em PROVA que não seja oficial
    const extraMc = await prisma.question.updateMany({
      where: {
        course_id: informaticaId,
        type: 'PROVA',
        format: 'MULTIPLE_CHOICE',
        id: { notIn: officialMcIds },
        active: true,
      },
      data: { active: false },
    })
    console.log(
      `[prova-oficial] MC oficiais: criadas=${created} atualizadas=${updated} extras_desativadas=${extraMc.count}`
    )

    // 4) Settings do curso: 8 de múltipla escolha + 2 discursivas
    const pairs: { suffix: 'question_count' | 'discursive_count'; value: number }[] = [
      { suffix: 'question_count', value: 8 },
      { suffix: 'discursive_count', value: 2 },
    ]
    for (const { suffix, value } of pairs) {
      const key = assessmentCourseSettingKey(informaticaId, suffix)
      await prisma.systemSetting.upsert({
        where: { key },
        create: {
          key,
          value: JSON.stringify(value),
          description: `Prova/simulado Informática — ${suffix}`,
        },
        update: { value: JSON.stringify(value) },
      })
    }
    // Espelho legado global (fallback)
    for (const [key, value] of [
      ['assessment.prova.question_count', 8],
      ['assessment.prova.discursive_count', 2],
      ['assessment.simulado.question_count', 8],
      ['assessment.simulado.discursive_count', 2],
    ] as const) {
      await prisma.systemSetting.upsert({
        where: { key },
        create: {
          key,
          value: JSON.stringify(value),
          description: 'Legado — preferir setting por curso',
        },
        update: { value: JSON.stringify(value) },
      })
    }
    console.log('[prova-oficial] settings: question_count=8, discursive_count=2')

    // Resumo final
    const summary = await prisma.question.groupBy({
      by: ['type', 'format', 'active'],
      where: { course_id: informaticaId },
      _count: true,
    })
    console.log('[prova-oficial] resumo Informática:')
    for (const row of summary) {
      console.log(
        `  ${row.type} ${row.format} active=${row.active}: ${row._count}`
      )
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error('[prova-oficial] FALHA:', e instanceof Error ? e.message : e)
  process.exit(1)
})
