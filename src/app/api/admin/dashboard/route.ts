import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAdmin } from '@/lib/auth/verify'
import { notDeleted, ofActiveStudent } from '@/lib/students/soft-delete'
import { getProvaUnlockState } from '@/lib/settings/assessment'
import { resolveAdminCourseId } from '@/lib/courses'

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

async function getDesempenhoPorTema(courseId: string) {
  const [dimensions, answers] = await Promise.all([
    prisma.dimension.findMany({
      where: { course_id: courseId },
      orderBy: { display_order: 'asc' },
      select: { id: true, name: true, active: true },
    }),
    prisma.assessmentAnswer.findMany({
      where: {
        is_correct: { not: null },
        assessment: {
          course_id: courseId,
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

export async function GET(req: Request) {
  try {
    await verifyAdmin()
    const courseId =
      new URL(req.url).searchParams.get('courseId') ||
      (await resolveAdminCourseId())

    const courseFilter = { course_id: courseId }

    const enrolledInCourse = {
      enrollments: { some: { course_id: courseId, status: 'ACTIVE' as const } },
    }

    const [
      totalStudents,
      pendingStudents,
      approvedStudents,
      blockedStudents,
      enrolledStudents,
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
      course,
    ] = await Promise.all([
      prisma.profile.count({
        where: { role: 'STUDENT', ...notDeleted, ...enrolledInCourse },
      }),
      prisma.profile.count({
        where: {
          role: 'STUDENT',
          status: 'PENDING',
          ...notDeleted,
          ...enrolledInCourse,
        },
      }),
      prisma.profile.count({
        where: {
          role: 'STUDENT',
          status: 'APPROVED',
          ...notDeleted,
          ...enrolledInCourse,
        },
      }),
      prisma.profile.count({
        where: {
          role: 'STUDENT',
          status: 'BLOCKED',
          ...notDeleted,
          ...enrolledInCourse,
        },
      }),
      prisma.courseEnrollment.count({
        where: {
          course_id: courseId,
          status: 'ACTIVE',
          student: { role: 'STUDENT', ...notDeleted },
        },
      }),
      prisma.assessment.count({
        where: { ...courseFilter, status: 'COMPLETED', type: 'PROVA', ...ofActiveStudent },
      }),
      prisma.assessment.count({
        where: {
          ...courseFilter,
          status: 'COMPLETED',
          type: 'PROVA',
          passed: true,
          ...ofActiveStudent,
        },
      }),
      prisma.assessment.count({
        where: {
          ...courseFilter,
          status: 'COMPLETED',
          type: 'PROVA',
          passed: false,
          ...ofActiveStudent,
        },
      }),
      prisma.assessment.count({
        where: {
          ...courseFilter,
          status: 'COMPLETED',
          type: 'SIMULADO',
          ...ofActiveStudent,
        },
      }),
      prisma.question.count({ where: { ...courseFilter, type: 'PROVA' } }),
      prisma.question.count({ where: { ...courseFilter, type: 'SIMULADO' } }),
      prisma.question.count({ where: { ...courseFilter, active: true } }),
      prisma.question.count({ where: { ...courseFilter, active: false } }),
      getProvaUnlockState(courseId),
      getDesempenhoPorTema(courseId),
      prisma.course.findUnique({
        where: { id: courseId },
        select: { id: true, name: true, slug: true },
      }),
    ])

    const avg = await prisma.assessment.aggregate({
      where: {
        ...courseFilter,
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

    // Pendências só do curso ativo (nunca de outros cursos).
    const pendingEnrollmentRows = await prisma.courseEnrollment.findMany({
      where: {
        course_id: courseId,
        status: 'PENDING',
        student: { role: 'STUDENT', ...notDeleted },
      },
      orderBy: { enrolled_at: 'asc' },
      take: 50,
      select: {
        id: true,
        course_id: true,
        enrolled_at: true,
        student_id: true,
        student: {
          select: {
            id: true,
            full_name: true,
            username: true,
            status: true,
          },
        },
        course: {
          select: { id: true, name: true },
        },
      },
    })

    // Contas pendentes: só quem pediu matrícula neste curso e ainda não foi listado acima
    // como solicitação de matrícula (evita duplicar e vazamento de outros cursos).
    const pendingEnrollmentStudentIds = new Set(
      pendingEnrollmentRows.map((e) => e.student_id)
    )
    const pendingAccounts = await prisma.profile.findMany({
      where: {
        role: 'STUDENT',
        status: 'PENDING',
        ...notDeleted,
        enrollments: {
          some: { course_id: courseId, status: 'PENDING' },
        },
      },
      orderBy: { created_at: 'asc' },
      take: 50,
      select: {
        id: true,
        full_name: true,
        username: true,
        email: true,
        phone: true,
        created_at: true,
      },
    })
    const pendingAccountsOnly = pendingAccounts.filter(
      (p) => !pendingEnrollmentStudentIds.has(p.id)
    )

    const alertas: string[] = []
    if (pendingAccountsOnly.length > 0) {
      alertas.push(
        `${pendingAccountsOnly.length} aluno(s) deste curso aguardando aprovação de conta.`
      )
    }
    if (pendingEnrollmentRows.length > 0) {
      alertas.push(
        `${pendingEnrollmentRows.length} solicitação(ões) de matrícula neste curso aguardando aprovação.`
      )
    }

    const pendingGradingRows = await prisma.assessment.findMany({
      where: {
        ...courseFilter,
        status: 'AWAITING_GRADING',
        ...ofActiveStudent,
      },
      orderBy: { completed_at: 'asc' },
      take: 50,
      select: {
        id: true,
        type: true,
        completed_at: true,
        started_at: true,
        student: {
          select: { id: true, full_name: true, username: true },
        },
        questions: {
          where: { format: 'DISCURSIVE' },
          select: {
            id: true,
            answers: {
              select: { score_percent: true },
              take: 1,
            },
          },
        },
      },
    })

    if (pendingGradingRows.length > 0) {
      alertas.push(
        `${pendingGradingRows.length} avaliação(ões) com discursivas aguardando correção.`
      )
    }

    return NextResponse.json({
      courseId,
      course,
      alunos: {
        total: totalStudents,
        matriculados: enrolledStudents,
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
      pendencias: {
        contas: pendingAccountsOnly.map((p) => ({
          id: p.id,
          fullName: p.full_name,
          username: p.username,
          email: p.email,
          phone: p.phone,
          createdAt: p.created_at,
        })),
        matriculas: pendingEnrollmentRows.map((e) => ({
          id: e.id,
          studentId: e.student_id,
          studentName: e.student.full_name,
          studentUsername: e.student.username,
          studentStatus: e.student.status,
          courseId: e.course_id,
          courseName: e.course.name,
          requestedAt: e.enrolled_at,
        })),
        correcoes: pendingGradingRows.map((a) => {
          const totalDisc = a.questions.length
          const gradedDisc = a.questions.filter(
            (q) => typeof q.answers[0]?.score_percent === 'number'
          ).length
          return {
            id: a.id,
            type: a.type,
            studentId: a.student.id,
            studentName: a.student.full_name,
            studentUsername: a.student.username,
            submittedAt: a.completed_at || a.started_at,
            pendingCount: Math.max(0, totalDisc - gradedDisc),
            totalDiscursive: totalDisc,
          }
        }),
      },
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
