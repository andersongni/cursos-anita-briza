import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { notDeleted, ofActiveStudent } from '@/lib/students/soft-delete'
import { getProvaUnlockState } from '@/lib/settings/assessment'

type ThemeBucket = { total: number; correct: number }

function toThemeStat(bucket: ThemeBucket) {
  return {
    total: bucket.total,
    correct: bucket.correct,
    wrong: bucket.total - bucket.correct,
    pct:
      bucket.total > 0
        ? Math.round((bucket.correct / bucket.total) * 1000) / 10
        : null,
  }
}

async function getDesempenhoPorTema() {
  const [dimensions, answers] = await Promise.all([
    prisma.dimension.findMany({
      orderBy: { display_order: 'asc' },
      select: { id: true, name: true, active: true },
    }),
    prisma.assessmentAnswer.findMany({
      where: {
        is_correct: { not: null },
        assessment: {
          status: 'COMPLETED',
          type: { in: ['PROVA', 'SIMULADO'] },
          ...ofActiveStudent,
        },
      },
      select: {
        is_correct: true,
        assessment: { select: { type: true } },
        assessmentQuestion: {
          select: {
            dimension_id: true,
            dimension_name_snapshot: true,
          },
        },
      },
    }),
  ])

  type Acc = {
    name: string
    active: boolean
    order: number
    prova: ThemeBucket
    simulado: ThemeBucket
  }

  const byKey = new Map<string, Acc>()

  dimensions.forEach((d, index) => {
    byKey.set(d.id, {
      name: d.name,
      active: d.active,
      order: index,
      prova: { total: 0, correct: 0 },
      simulado: { total: 0, correct: 0 },
    })
  })

  for (const row of answers) {
    const dimId = row.assessmentQuestion.dimension_id
    const key = dimId ?? `snapshot:${row.assessmentQuestion.dimension_name_snapshot}`
    let entry = byKey.get(key)
    if (!entry) {
      entry = {
        name: row.assessmentQuestion.dimension_name_snapshot || 'Sem tema',
        active: false,
        order: 10_000 + byKey.size,
        prova: { total: 0, correct: 0 },
        simulado: { total: 0, correct: 0 },
      }
      byKey.set(key, entry)
    }

    const bucket = row.assessment.type === 'PROVA' ? entry.prova : entry.simulado
    bucket.total += 1
    if (row.is_correct) bucket.correct += 1
  }

  return [...byKey.entries()]
    .map(([key, entry]) => ({
      dimensionId: key.startsWith('snapshot:') ? null : key,
      name: entry.name,
      active: entry.active,
      order: entry.order,
      prova: toThemeStat(entry.prova),
      simulado: toThemeStat(entry.simulado),
    }))
    .filter(
      (row) =>
        row.prova.total > 0 ||
        row.simulado.total > 0 ||
        row.active
    )
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name, 'pt-BR'))
    .map(({ order: _order, ...rest }) => rest)
}

export async function GET() {
  try {
    await verifyAdmin()

    const [
      totalStudents,
      pendingStudents,
      approvedStudents,
      blockedStudents,
      totalAssessments,
      passedAssessments,
      failedAssessments,
      simulados,
      totalProvaQuestions,
      totalSimuladoQuestions,
      activeQuestions,
      inactiveQuestions,
      provaUnlock,
      desempenhoPorTema,
    ] = await Promise.all([
      prisma.profile.count({ where: { role: 'STUDENT', ...notDeleted } }),
      prisma.profile.count({ where: { role: 'STUDENT', status: 'PENDING', ...notDeleted } }),
      prisma.profile.count({ where: { role: 'STUDENT', status: 'APPROVED', ...notDeleted } }),
      prisma.profile.count({ where: { role: 'STUDENT', status: 'BLOCKED', ...notDeleted } }),
      prisma.assessment.count({
        where: { status: 'COMPLETED', type: 'PROVA', ...ofActiveStudent },
      }),
      prisma.assessment.count({
        where: { status: 'COMPLETED', type: 'PROVA', passed: true, ...ofActiveStudent },
      }),
      prisma.assessment.count({
        where: { status: 'COMPLETED', type: 'PROVA', passed: false, ...ofActiveStudent },
      }),
      prisma.assessment.count({
        where: { status: 'COMPLETED', type: 'SIMULADO', ...ofActiveStudent },
      }),
      prisma.question.count({ where: { type: 'PROVA' } }),
      prisma.question.count({ where: { type: 'SIMULADO' } }),
      prisma.question.count({ where: { active: true } }),
      prisma.question.count({ where: { active: false } }),
      getProvaUnlockState(),
      getDesempenhoPorTema(),
    ])

    const avg = await prisma.assessment.aggregate({
      where: {
        status: 'COMPLETED',
        type: 'PROVA',
        score: { not: null },
        ...ofActiveStudent,
      },
      _avg: { score: true },
    })

    const taxaAprovacao =
      totalAssessments > 0
        ? Math.round((passedAssessments / totalAssessments) * 1000) / 10
        : 0

    const alertas: string[] = []
    if (pendingStudents > 0) {
      alertas.push(
        `${pendingStudents} aluno(s) aguardando aprovação.`
      )
    }

    return NextResponse.json({
      alunos: {
        total: totalStudents,
        pendentes: pendingStudents,
        aprovados: approvedStudents,
        bloqueados: blockedStudents,
      },
      avaliacoes: {
        realizadas: totalAssessments,
        aprovados: passedAssessments,
        reprovados: failedAssessments,
        simulados,
      },
      desempenho: {
        media: Math.round((avg._avg.score ?? 0) * 10) / 10,
        taxaAprovacao,
      },
      desempenhoPorTema,
      perguntas: {
        totalProva: totalProvaQuestions,
        totalSimulado: totalSimuladoQuestions,
        ativas: activeQuestions,
        inativas: inactiveQuestions,
      },
      prova: {
        unlocked: provaUnlock.open,
        unlockUntil: provaUnlock.unlockUntil,
        remainingMs: provaUnlock.remainingMs,
      },
      alertas,
    })
  } catch (error: unknown) {
    console.error('Error fetching dashboard metrics:', error)
    const err = error as { message?: string; status?: number }
    return NextResponse.json(
      { error: err.message || 'Internal Server Error' },
      { status: err.status || 500 }
    )
  }
}
