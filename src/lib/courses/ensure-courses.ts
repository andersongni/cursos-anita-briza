import { prisma } from '@/lib/db'
import { DEFAULT_COURSES, ELETRICA_DIMENSIONS } from '@/lib/courses/constants'

/**
 * Garante cursos padrão, temas da Elétrica e backfill de course_id em dados antigos.
 * Idempotente — seguro chamar no boot / setup.
 */
export async function ensureCourses(): Promise<{
  informaticaId: string
  eletricaId: string
}> {
  // Não sobrescreve nome/active: admin pode editar ou excluir logicamente.
  const informatica = await prisma.course.upsert({
    where: { slug: 'informatica-basica' },
    update: {},
    create: { ...DEFAULT_COURSES[0] },
  })

  const eletrica = await prisma.course.upsert({
    where: { slug: 'eletrica-basica' },
    update: {},
    create: { ...DEFAULT_COURSES[1] },
  })

  // Backfill: tudo sem curso → Informática (dados históricos)
  await prisma.$executeRawUnsafe(
    `UPDATE Dimension SET course_id = ? WHERE course_id IS NULL OR course_id = ''`,
    informatica.id
  )
  await prisma.$executeRawUnsafe(
    `UPDATE Question SET course_id = ? WHERE course_id IS NULL OR course_id = ''`,
    informatica.id
  )
  await prisma.$executeRawUnsafe(
    `UPDATE Assessment SET course_id = ? WHERE course_id IS NULL OR course_id = ''`,
    informatica.id
  )
  await prisma.$executeRawUnsafe(
    `UPDATE Certificate SET course_id = ? WHERE course_id IS NULL OR course_id = ''`,
    informatica.id
  )
  await prisma.$executeRawUnsafe(
    `UPDATE AttemptRelease SET course_id = ? WHERE course_id IS NULL OR course_id = ''`,
    informatica.id
  )

  // Temas iniciais da Elétrica (perguntas: npm run seed:eletrica)
  const existingEletricaDims = await prisma.dimension.count({
    where: { course_id: eletrica.id },
  })
  if (existingEletricaDims === 0) {
    for (const dim of ELETRICA_DIMENSIONS) {
      await prisma.dimension.create({
        data: {
          course_id: eletrica.id,
          name: dim.name,
          description: dim.description,
          target_percentage: dim.target_percentage,
          display_order: dim.display_order,
          weight: 1,
          active: true,
        },
      })
    }
  }

  // Sync nome do curso Informática para setting legado (certificado / UI)
  const courseNameSetting = await prisma.systemSetting.findUnique({
    where: { key: 'platform.course_name' },
  })
  if (!courseNameSetting) {
    await prisma.systemSetting.create({
      data: {
        key: 'platform.course_name',
        value: JSON.stringify(informatica.name),
        description: 'Nome do curso (legado; preferir Course.name)',
      },
    })
  }

  // Renomeia marca legada (Avaliação → Estudos)
  const platformName = await prisma.systemSetting.findUnique({
    where: { key: 'platform.name' },
  })
  if (!platformName) {
    await prisma.systemSetting.create({
      data: {
        key: 'platform.name',
        value: JSON.stringify('Plataforma de Estudos'),
        description: 'Nome da plataforma',
      },
    })
  } else {
    let current = platformName.value
    try {
      current = JSON.parse(platformName.value)
    } catch {
      // raw
    }
    if (current === 'Plataforma de Avaliação') {
      await prisma.systemSetting.update({
        where: { key: 'platform.name' },
        data: { value: JSON.stringify('Plataforma de Estudos') },
      })
    }
  }

  return { informaticaId: informatica.id, eletricaId: eletrica.id }
}
