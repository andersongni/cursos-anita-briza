import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db'
import { verifyAuth } from '@/lib/auth/verify'
import { computeTypingStats } from '@/lib/exercises/typing'
import { buildTypingRanking } from '@/lib/exercises/typing-ranking'

export async function POST(req: Request) {
  try {
    const { user, profile } = await verifyAuth()
    if (profile.role !== 'STUDENT' && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }
    if (profile.status !== 'APPROVED' && profile.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Conta não aprovada' }, { status: 403 })
    }

    const body = await req.json()
    const passageId = typeof body.passageId === 'string' ? body.passageId : ''
    const durationMs = Number(body.durationMs)
    const errorCount = Number(body.errorCount)

    if (!passageId) {
      return NextResponse.json({ error: 'Texto não informado' }, { status: 400 })
    }
    if (!Number.isFinite(durationMs) || durationMs < 500) {
      return NextResponse.json({ error: 'Tempo inválido' }, { status: 400 })
    }
    if (!Number.isFinite(errorCount) || errorCount < 0) {
      return NextResponse.json({ error: 'Contagem de erros inválida' }, { status: 400 })
    }

    const passage = await prisma.typingPassage.findFirst({
      where: { id: passageId, active: true },
    })
    if (!passage) {
      return NextResponse.json({ error: 'Texto não encontrado ou inativo' }, { status: 404 })
    }

    const charsTotal = passage.content.length
    // Limite de sanidade: menos de ~5 PPM ou mais de 400 PPM é suspeito
    const minutes = durationMs / 60000
    const rawWpm = charsTotal / 5 / minutes
    if (rawWpm > 400 || durationMs > 60 * 60 * 1000) {
      return NextResponse.json({ error: 'Resultado inválido. Tente novamente.' }, { status: 400 })
    }

    const stats = computeTypingStats({
      charsTotal,
      errorCount: Math.floor(errorCount),
      durationMs: Math.floor(durationMs),
    })

    const attempt = await prisma.typingAttempt.create({
      data: {
        student_id: user.id,
        passage_id: passage.id,
        duration_ms: stats.durationMs,
        error_count: stats.errorCount,
        chars_total: stats.charsTotal,
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        score: stats.score,
      },
    })

    const ranking = await buildTypingRanking({
      studentId: user.id,
      currentAttemptId: attempt.id,
      currentDurationMs: stats.durationMs,
    })

    return NextResponse.json({
      attempt: {
        id: attempt.id,
        durationMs: stats.durationMs,
        errorCount: stats.errorCount,
        charsTotal: stats.charsTotal,
        wpm: stats.wpm,
        accuracy: stats.accuracy,
        score: stats.score,
        completedAt: attempt.completed_at,
      },
      passage: {
        id: passage.id,
        title: passage.title,
      },
      ranking,
    })
  } catch (err: unknown) {
    const status = (err as { status?: number }).status ?? 500
    const message = err instanceof Error ? err.message : 'Erro ao salvar resultado'
    return NextResponse.json({ error: message }, { status })
  }
}
