import { prisma } from '@/lib/db'
import { MOUSE_ACCURACY_RANKING_SCALAR_FIELDS } from '@/lib/exercises/mouse-accuracy'

export type MouseAccuracyRankingRow = {
  rank: number
  attemptId: string
  studentId: string
  fullName: string
  username: string
  durationMs: number
  hits: number
  misses: number
  expired: number
  points: number
  accuracy: number
  score: number
  maxCombo: number
  avgReactionMs: number
  completedAt: string
  isCurrentUser: boolean
  isCurrentAttempt: boolean
}

type AttemptRecord = {
  id: string
  student_id: string
  duration_ms: number
  hits: number
  misses: number
  expired: number
  points: number
  accuracy: number
  score: number
  max_combo: number
  avg_reaction_ms: number
  completed_at: Date
  student: { full_name: string; username: string }
}

async function fetchMouseAccuracyAttempts(): Promise<AttemptRecord[]> {
  return prisma.mouseAccuracyAttempt.findMany({
    where: {
      student: {
        deleted_at: null,
        OR: [{ status: 'APPROVED' }, { role: 'ADMIN' }],
      },
    },
    select: {
      ...Object.fromEntries(
        MOUSE_ACCURACY_RANKING_SCALAR_FIELDS.map((field) => [field, true])
      ),
      student: { select: { full_name: true, username: true } },
    },
    orderBy: [
      { score: 'desc' },
      { avg_reaction_ms: 'asc' },
      { accuracy: 'desc' },
      { hits: 'desc' },
      { completed_at: 'asc' },
    ],
  })
}

function toRows(
  attempts: AttemptRecord[],
  opts?: { studentId?: string; currentAttemptId?: string }
): MouseAccuracyRankingRow[] {
  return attempts.map((attempt, index) => ({
    rank: index + 1,
    attemptId: attempt.id,
    studentId: attempt.student_id,
    fullName: attempt.student.full_name,
    username: attempt.student.username,
    durationMs: attempt.duration_ms,
    hits: attempt.hits,
    misses: attempt.misses,
    expired: attempt.expired,
    points: attempt.points,
    accuracy: attempt.accuracy,
    score: attempt.score,
    maxCombo: attempt.max_combo,
    avgReactionMs: attempt.avg_reaction_ms,
    completedAt: attempt.completed_at.toISOString(),
    isCurrentUser: opts?.studentId ? attempt.student_id === opts.studentId : false,
    isCurrentAttempt: opts?.currentAttemptId
      ? attempt.id === opts.currentAttemptId
      : false,
  }))
}

/** Ranking completo (admin). */
export async function listMouseAccuracyRanking(): Promise<{
  rows: MouseAccuracyRankingRow[]
  totalAttempts: number
}> {
  const attempts = await fetchMouseAccuracyAttempts()
  const rows = toRows(attempts)
  return { rows, totalAttempts: rows.length }
}

/**
 * Ranking para o aluno após concluir uma partida (top 10 + posição atual).
 */
export async function buildMouseAccuracyRanking(opts: {
  studentId: string
  currentAttemptId: string
  currentScore: number
}): Promise<{
  top: MouseAccuracyRankingRow[]
  me: MouseAccuracyRankingRow
  totalAttempts: number
}> {
  const attempts = await fetchMouseAccuracyAttempts()
  const rows = toRows(attempts, {
    studentId: opts.studentId,
    currentAttemptId: opts.currentAttemptId,
  })

  const me =
    rows.find((r) => r.isCurrentAttempt) ??
    ({
      rank: rows.length + 1,
      attemptId: opts.currentAttemptId,
      studentId: opts.studentId,
      fullName: 'Você',
      username: '',
      durationMs: 60_000,
      hits: 0,
      misses: 0,
      expired: 0,
      points: 0,
      accuracy: 0,
      score: opts.currentScore,
      maxCombo: 0,
      avgReactionMs: 0,
      completedAt: new Date().toISOString(),
      isCurrentUser: true,
      isCurrentAttempt: true,
    } satisfies MouseAccuracyRankingRow)

  return {
    top: rows.slice(0, 10),
    me,
    totalAttempts: rows.length,
  }
}
