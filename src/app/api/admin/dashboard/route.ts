import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'

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
    ] = await Promise.all([
      prisma.profile.count({ where: { role: 'STUDENT' } }),
      prisma.profile.count({ where: { role: 'STUDENT', status: 'PENDING' } }),
      prisma.profile.count({ where: { role: 'STUDENT', status: 'APPROVED' } }),
      prisma.profile.count({ where: { role: 'STUDENT', status: 'BLOCKED' } }),
      prisma.assessment.count({ where: { status: 'COMPLETED', type: 'PROVA' } }),
      prisma.assessment.count({ where: { status: 'COMPLETED', type: 'PROVA', passed: true } }),
      prisma.assessment.count({ where: { status: 'COMPLETED', type: 'PROVA', passed: false } }),
      prisma.assessment.count({ where: { status: 'COMPLETED', type: 'SIMULADO' } }),
      prisma.question.count({ where: { type: 'PROVA' } }),
      prisma.question.count({ where: { type: 'SIMULADO' } }),
      prisma.question.count({ where: { active: true } }),
      prisma.question.count({ where: { active: false } }),
    ])

    const avg = await prisma.assessment.aggregate({
      where: { status: 'COMPLETED', type: 'PROVA', score: { not: null } },
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
      perguntas: {
        totalProva: totalProvaQuestions,
        totalSimulado: totalSimuladoQuestions,
        ativas: activeQuestions,
        inativas: inactiveQuestions,
      },
      alertas,
    })
  } catch (error: any) {
    console.error('Error fetching dashboard metrics:', error)
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: error.status || 500 }
    )
  }
}
