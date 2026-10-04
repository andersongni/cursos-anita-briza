import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { getAssessmentSettings, getProvaUnlockState } from '@/lib/settings/assessment'

/**
 * Distribui N questões pelos temas conforme target_percentage.
 * Temas podem ficar com 0 quando N < quantidade de temas (evita loop infinito).
 */
function calculateDistribution(
  dimensions: { id: string; name: string; target_percentage: number; weight: number }[],
  totalQuestions: number
) {
  if (dimensions.length === 0 || totalQuestions <= 0) return []

  const n = Math.floor(totalQuestions)
  const weightSum = dimensions.reduce((s, d) => s + (d.target_percentage || 0), 0)
  const useEqual = weightSum <= 0

  const raw = dimensions.map((d) => {
    const share = useEqual
      ? 1 / dimensions.length
      : (d.target_percentage || 0) / weightSum
    const exact = share * n
    return {
      dimension_id: d.id,
      dimension_name: d.name,
      weight: d.weight || 1,
      exact,
      count: Math.floor(exact),
      frac: exact - Math.floor(exact),
    }
  })

  let currentTotal = raw.reduce((s, d) => s + d.count, 0)
  // Método dos maiores restos: completa até N
  const byFrac = [...raw].sort(
    (a, b) => b.frac - a.frac || (b.weight || 1) - (a.weight || 1)
  )
  let i = 0
  while (currentTotal < n && byFrac.length > 0) {
    byFrac[i % byFrac.length].count++
    currentTotal++
    i++
  }

  // Segurança: nunca ultrapassar N
  while (currentTotal > n) {
    const sortable = [...raw].sort((a, b) => b.count - a.count || (a.weight || 1) - (b.weight || 1))
    const victim = sortable.find((d) => d.count > 0)
    if (!victim) break
    victim.count--
    currentTotal--
  }

  return raw
    .filter((d) => d.count > 0)
    .map((d) => ({
      dimension_id: d.dimension_id,
      dimension_name: d.dimension_name,
      count: d.count,
    }))
}

function shuffle<T>(array: T[]): T[] {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

export async function POST(req: Request) {
  try {
    const { user, profile } = await verifyAuth()

    if (profile.status !== 'APPROVED' && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Conta não aprovada' }, { status: 403 })
    }

    const body = await req.json()
    const { type } = body

    if (type !== 'PROVA' && type !== 'SIMULADO') {
      return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 })
    }

    const inProgress = await prisma.assessment.findFirst({
      where: { student_id: user.id, type, status: 'IN_PROGRESS' },
    })

    if (inProgress) {
      const questionCount = await prisma.assessmentQuestion.count({
        where: { assessment_id: inProgress.id },
      })
      const expired =
        !!inProgress.deadline_at && new Date() > new Date(inProgress.deadline_at)
      const empty = questionCount === 0 || inProgress.total_questions === 0

      // Avaliações vazias ou com prazo vencido não devem ser retomadas
      if (empty || expired) {
        await prisma.assessmentAnswer.deleteMany({
          where: { assessment_id: inProgress.id },
        })
        await prisma.assessmentQuestion.deleteMany({
          where: { assessment_id: inProgress.id },
        })
        await prisma.assessment.delete({ where: { id: inProgress.id } })
      } else {
        return NextResponse.json({
          id: inProgress.id,
          assessment_id: inProgress.id,
          type: inProgress.type,
          status: inProgress.status,
          total_questions: inProgress.total_questions,
          started_at: inProgress.started_at,
          deadline_at: inProgress.deadline_at,
          resumed: true,
        })
      }
    }

    // Nova prova só pode ser iniciada na janela liberada pelo admin (padrão: bloqueada)
    if (type === 'PROVA') {
      const unlock = await getProvaUnlockState()
      if (!unlock.open) {
        return NextResponse.json(
          {
            error:
              'A prova oficial está bloqueada. Aguarde a liberação pelo administrador.',
            unlockUntil: unlock.unlockUntil,
          },
          { status: 403 }
        )
      }
    }

    let attempt_number = 1

    if (type === 'PROVA') {
      const lastProva = await prisma.assessment.findFirst({
        where: {
          student_id: user.id,
          type: 'PROVA',
          status: { in: ['COMPLETED', 'EXPIRED'] },
        },
        orderBy: { created_at: 'desc' },
      })

      if (lastProva) {
        attempt_number = (lastProva.attempt_number || 1) + 1
      }
    }

    const typeKey = type === 'PROVA' ? 'prova' : 'simulado'
    const settings = await getAssessmentSettings(typeKey)
    const totalQuestions = settings.questionCount
    const timeLimitMins = settings.timeLimitMinutes

    const dimensions = await prisma.dimension.findMany({
      where: { active: true },
      orderBy: { display_order: 'asc' },
    })

    type QWithOpts = Awaited<
      ReturnType<typeof prisma.question.findMany<{ include: { options: true; dimension: true } }>>
    >[number]

    let selectedQuestions: QWithOpts[] = []

    if (dimensions.length > 0) {
      const dist = calculateDistribution(dimensions, totalQuestions)
      for (const d of dist) {
        const qs = await prisma.question.findMany({
          where: { dimension_id: d.dimension_id, type, active: true },
          include: { options: true, dimension: true },
        })
        selectedQuestions.push(...shuffle(qs).slice(0, d.count))
      }
    } else {
      const qs = await prisma.question.findMany({
        where: { type, active: true },
        include: { options: true, dimension: true },
      })
      selectedQuestions = shuffle(qs).slice(0, totalQuestions)
    }

    // Garante no máximo o configurado (caso algum tema tenha menos perguntas que o pedido)
    selectedQuestions = shuffle(selectedQuestions).slice(0, totalQuestions)

    if (selectedQuestions.length === 0) {
      return NextResponse.json(
        {
          error:
            'Não há perguntas disponíveis para montar esta avaliação. Peça ao administrador para cadastrar ou importar o banco de questões (npm run seed).',
        },
        { status: 400 }
      )
    }

    if (selectedQuestions.length < totalQuestions) {
      console.warn(
        `Avaliação ${type}: pedidas ${totalQuestions}, disponíveis ${selectedQuestions.length}`
      )
    }

    const started_at = new Date()
    const deadline_at = new Date(started_at.getTime() + timeLimitMins * 60000)

    const assessment = await prisma.assessment.create({
      data: {
        student_id: user.id,
        type,
        status: 'IN_PROGRESS',
        attempt_number: type === 'PROVA' ? attempt_number : 1,
        started_at,
        deadline_at,
        total_questions: selectedQuestions.length,
      },
    })

    const aqs = await prisma.$transaction(
      selectedQuestions.map((q, idx) => {
        // Embaralha alternativas nesta tentativa; A–E são só rótulos de apresentação
        const shuffled = shuffle(q.options)
        const [optA, optB, optC, optD, optE] = shuffled
        const letters = ['a', 'b', 'c', 'd', 'e'] as const
        const correctIndex = shuffled.findIndex((o) => o.is_correct)
        const correct_option = letters[correctIndex >= 0 ? correctIndex : 0]

        return prisma.assessmentQuestion.create({
          data: {
            assessment_id: assessment.id,
            question_id: q.id,
            question_order: idx + 1,
            dimension_id: q.dimension_id,
            dimension_name_snapshot: q.dimension?.name ?? 'Geral',
            question_text_snapshot: q.question_text,
            option_a_text: optA?.option_text ?? '',
            option_b_text: optB?.option_text ?? '',
            option_c_text: optC?.option_text ?? '',
            option_d_text: optD?.option_text ?? '',
            option_e_text: optE?.option_text ?? '',
            option_a_explanation: optA?.explanation ?? '',
            option_b_explanation: optB?.explanation ?? '',
            option_c_explanation: optC?.explanation ?? '',
            option_d_explanation: optD?.explanation ?? '',
            option_e_explanation: optE?.explanation ?? '',
            correct_option,
          },
        })
      })
    )

    await prisma.assessmentAnswer.createMany({
      data: aqs.map((aq) => ({
        assessment_id: assessment.id,
        assessment_question_id: aq.id,
        flagged_for_review: false,
      })),
    })

    return NextResponse.json({
      id: assessment.id,
      assessment_id: assessment.id,
      type: assessment.type,
      status: assessment.status,
      total_questions: assessment.total_questions,
      started_at: assessment.started_at,
      deadline_at: assessment.deadline_at,
    })
  } catch (error: any) {
    console.error('Create assessment error:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao criar avaliação' },
      { status: error.status || 500 }
    )
  }
}
