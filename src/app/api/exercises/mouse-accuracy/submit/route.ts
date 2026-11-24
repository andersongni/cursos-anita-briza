import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import {
  MOUSE_ACCURACY_DURATION_MS,
  buildMouseAccuracyAttemptCreateData,
  computeMouseAccuracyStats,
} from '@/lib/exercises/mouse-accuracy'
import { buildMouseAccuracyRanking } from '@/lib/exercises/mouse-accuracy-ranking'
import { assertMouseAccuracyExerciseAccess } from '@/lib/courses'

export async function POST(req: Request) {
  try {
    const { user, profile } = await verifyAuth()
    if (profile.role !== 'STUDENT' && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (profile.status !== 'APPROVED' && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Conta não aprovada' }, { status: 403 })
    }
    if (profile.role === 'STUDENT') {
      await assertMouseAccuracyExerciseAccess(user.id)
    }

    const body = await req.json()
    const hits = Number(body.hits)
    const misses = Number(body.misses)
    const expired = Number(body.expired)
    const points = Number(body.points)
    const maxCombo = Number(body.maxCombo)
    const durationMs = Number(body.durationMs)
    const reactionSumMs = Number(body.reactionSumMs)

    if (!Number.isFinite(hits) || hits < 0 || hits > 500) {
      return NextResponse.json({ error: 'Acertos inválidos' }, { status: 400 })
    }
    if (!Number.isFinite(misses) || misses < 0 || misses > 2000) {
      return NextResponse.json({ error: 'Erros inválidos' }, { status: 400 })
    }
    if (!Number.isFinite(expired) || expired < 0 || expired > 2000) {
      return NextResponse.json({ error: 'Alvos perdidos inválidos' }, { status: 400 })
    }
    if (!Number.isFinite(points) || points < -2000 || points > 20_000) {
      return NextResponse.json({ error: 'Pontuação inválida' }, { status: 400 })
    }
    if (!Number.isFinite(maxCombo) || maxCombo < 0 || maxCombo > 500) {
      return NextResponse.json({ error: 'Sequência inválida' }, { status: 400 })
    }
    if (
      !Number.isFinite(durationMs) ||
      durationMs < MOUSE_ACCURACY_DURATION_MS - 2500 ||
      durationMs > MOUSE_ACCURACY_DURATION_MS + 2500
    ) {
      return NextResponse.json({ error: 'Duração inválida' }, { status: 400 })
    }
    if (
      !Number.isFinite(reactionSumMs) ||
      reactionSumMs < 0 ||
      reactionSumMs > hits * 20_000
    ) {
      return NextResponse.json({ error: 'Tempo de reação inválido' }, { status: 400 })
    }

    const stats = computeMouseAccuracyStats({
      hits: Math.floor(hits),
      misses: Math.floor(misses),
      expired: Math.floor(expired),
      points: Math.floor(points),
      durationMs: Math.floor(durationMs),
      maxCombo: Math.floor(maxCombo),
      reactionSumMs: Math.floor(reactionSumMs),
    })

    const attempt = await prisma.mouseAccuracyAttempt.create({
      data: buildMouseAccuracyAttemptCreateData(user.id, stats),
    })

    const ranking = await buildMouseAccuracyRanking({
      studentId: user.id,
      currentAttemptId: attempt.id,
      currentScore: stats.score,
    })

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        durationMs: stats.durationMs,
        hits: stats.hits,
        misses: stats.misses,
        expired: stats.expired,
        points: stats.points,
        accuracy: stats.accuracy,
        accuracyBonus: stats.accuracyBonus,
        score: stats.score,
        maxCombo: stats.maxCombo,
        avgReactionMs: stats.avgReactionMs,
        completedAt: attempt.completed_at,
      },
      ranking,
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Erro ao salvar resultado'
    return NextResponse.json({ error: message }, { status })
  }
}
