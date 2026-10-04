import { prisma } from '@/lib/db'

export type RankingRow = {
  rank: number
  attemptId: string
  studentId: string
  fullName: string
  username: string
  passageTitle: string
  durationMs: number
  errorCount: number
  wpm: number
  score: number
  accuracy: number
  completedAt: string
  isCurrentUser: boolean
  isCurrentAttempt: boolean
}

type AttemptRecord = {
  id: string
  student_id: string
  duration_ms: number
  error_count: number
  wpm: number
  score: number
  accuracy: number
  completed_at: Date
  student: { full_name: string; username: string }
  passage: { title: string }
}

async function fetchTypingAttempts(): Promise<AttemptRecord[]> {
  return prisma.typingAttempt.findMany({
    where: {
      student: {
        deleted_at: null,
        OR: [{ status: 'APPROVED' }, { role: 'ADMIN' }],
      },
    },
    select: {
      id: true,
      student_id: true,
      duration_ms: true,
      error_count: true,
      wpm: true,
      score: true,
      accuracy: true,
      completed_at: true,
      student: { select: { full_name: true, username: true } },
      passage: { select: { title: true } },
    },
    orderBy: [{ duration_ms: 'asc' }, { error_count: 'asc' }, { completed_at: 'asc' }],
  })
}

function toRows(
  attempts: AttemptRecord[],
  opts?: { studentId?: string; currentAttemptId?: string }
): RankingRow[] {
  return attempts.map((attempt, index) => ({
    rank: index + 1,
    attemptId: attempt.id,
    studentId: attempt.student_id,
    fullName: attempt.student.full_name,
    username: attempt.student.username,
    passageTitle: attempt.passage.title,
    durationMs: attempt.duration_ms,
    errorCount: attempt.error_count,
    wpm: attempt.wpm,
    score: attempt.score,
    accuracy: attempt.accuracy,
    completedAt: attempt.completed_at.toISOString(),
    isCurrentUser: opts?.studentId ? attempt.student_id === opts.studentId : false,
    isCurrentAttempt: opts?.currentAttemptId
      ? attempt.id === opts.currentAttemptId
      : false,
  }))
}

/** Ranking completo (admin). */
export async function listTypingRanking(): Promise<{
  rows: RankingRow[]
  totalAttempts: number
}> {
  const attempts = await fetchTypingAttempts()
  const rows = toRows(attempts)
  return { rows, totalAttempts: rows.length }
}

/**
 * Ranking para o aluno após concluir uma prática (top 10 + posição atual).
 */
export async function buildTypingRanking(opts: {
  studentId: string
  currentAttemptId: string
  currentDurationMs: number
}): Promise<{ top: RankingRow[]; me: RankingRow; totalAttempts: number }> {
  const attempts = await fetchTypingAttempts()
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
      passageTitle: '',
      durationMs: opts.currentDurationMs,
      errorCount: 0,
      wpm: 0,
      score: 0,
      accuracy: 0,
      completedAt: new Date().toISOString(),
      isCurrentUser: true,
      isCurrentAttempt: true,
    } satisfies RankingRow)

  return {
    top: rows.slice(0, 10),
    me,
    totalAttempts: rows.length,
  }
}
