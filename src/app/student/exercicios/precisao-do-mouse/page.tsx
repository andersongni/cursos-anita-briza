'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trophy, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import MouseAccuracyPractice, {
  type MouseAccuracyResult,
} from '@/components/exercises/MouseAccuracyPractice'
import MouseAccuracyPerformance from '@/components/exercises/MouseAccuracyPerformance'
import { formatDateTime } from '@/lib/utils'

type AttemptResult = {
  id: string
  durationMs: number
  hits: number
  misses: number
  expired: number
  points: number
  accuracy: number
  accuracyBonus: number
  score: number
  maxCombo: number
  avgReactionMs: number
}

type RankingRow = {
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

function formatReactionMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

type RankingPayload = {
  top: RankingRow[]
  me: RankingRow
  totalAttempts: number
}

export default function PrecisaoDoMousePage() {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [attempt, setAttempt] = useState<AttemptResult | null>(null)
  const [ranking, setRanking] = useState<RankingPayload | null>(null)
  const [runKey, setRunKey] = useState(0)
  const [accessError, setAccessError] = useState<string | null>(null)
  const [submitFailed, setSubmitFailed] = useState(false)

  const resetRun = () => {
    setAttempt(null)
    setRanking(null)
    setAccessError(null)
    setSubmitFailed(false)
    setRunKey((k) => k + 1)
  }

  const handleAbort = () => {
    toast('Partida cancelada — resultado não salvo')
    router.push('/student/exercicios')
  }

  const handleComplete = async (payload: MouseAccuracyResult) => {
    setSubmitting(true)
    setAccessError(null)
    setSubmitFailed(false)
    try {
      const res = await fetch('/api/exercises/mouse-accuracy/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) {
        if (res.status === 403) {
          setAccessError(data.error || 'Acesso negado')
          return
        }
        throw new Error(data.error || 'Erro ao salvar resultado')
      }
      setAttempt(data.attempt)
      setRanking(data.ranking)
      toast.success('Partida concluída!')
    } catch (e: unknown) {
      setSubmitFailed(true)
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar resultado')
    } finally {
      setSubmitting(false)
    }
  }

  const showMeOutsideTop =
    ranking != null &&
    ranking.me.rank > 10 &&
    !ranking.top.some((r) => r.isCurrentAttempt)

  if (!attempt && !accessError) {
    return (
      <MouseAccuracyPractice
        key={runKey}
        onComplete={(r) => void handleComplete(r)}
        onAbort={handleAbort}
        submitting={submitting}
        onPlayAgain={resetRun}
      />
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/student/exercicios"
            className="inline-flex items-center text-sm text-accent hover:text-secondary mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar aos exercícios
          </Link>
          <h1 className="text-3xl font-bold text-secondary">Precisão do mouse</h1>
          <p className="text-slate-600 mt-1">
            Treine mira e controle do ponteiro. Ao terminar, veja sua nota e o ranking.
          </p>
        </div>
        {(attempt || submitFailed) && (
          <Button variant="outline" onClick={resetRun} disabled={submitting}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Nova partida
          </Button>
        )}
      </div>

      {accessError && !attempt && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-slate-600">{accessError}</p>
            <Link href="/student/matriculas">
              <Button variant="primary">Ver matrículas</Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {attempt && ranking && (
        <div className="space-y-6">
          <Card className="border-t-4 border-t-brand-gold">
            <CardHeader>
              <CardTitle className="text-2xl text-secondary">Seu resultado</CardTitle>
              <p className="text-slate-600 mt-1">Partida de 60 segundos · nível fácil · alvo grande</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <MouseAccuracyPerformance
                hits={attempt.hits}
                misses={attempt.misses}
                expired={attempt.expired}
                durationMs={attempt.durationMs}
              />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <Stat label="Nota" value={`${attempt.score}`} emphasize />
                <Stat label="Pontos" value={String(attempt.points)} />
                <Stat label="Bônus" value={`+${attempt.accuracyBonus}`} />
                <Stat label="Precisão" value={`${attempt.accuracy.toFixed(1)}%`} />
                <Stat label="Melhor sequência" value={String(attempt.maxCombo)} />
                <Stat label="Reação média" value={formatReactionMs(attempt.avgReactionMs)} />
                <Stat label="Duração" value="60s" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-brand-gold-dark" />
                <CardTitle className="text-2xl text-secondary">
                  Ranking — melhores notas
                </CardTitle>
              </div>
              <p className="text-slate-600 mt-1">
                Top 10 de todas as partidas de precisão do mouse · {ranking.totalAttempts}{' '}
                registrada{ranking.totalAttempts === 1 ? '' : 's'}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Aluno</th>
                      <th className="px-3 py-2 font-medium">Data e hora</th>
                      <th className="px-3 py-2 font-medium">Nota</th>
                      <th className="px-3 py-2 font-medium">Pontos</th>
                      <th className="px-3 py-2 font-medium">Acertos</th>
                      <th className="px-3 py-2 font-medium">Erros</th>
                      <th className="px-3 py-2 font-medium">Sumiram</th>
                      <th className="px-3 py-2 font-medium">Precisão</th>
                      <th className="px-3 py-2 font-medium">Reação</th>
                      <th className="px-3 py-2 font-medium">Sequência</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ranking.top.map((row) => (
                      <tr
                        key={row.attemptId}
                        className={
                          row.isCurrentAttempt
                            ? 'bg-sky-50 border-l-4 border-l-primary font-semibold text-secondary'
                            : row.isCurrentUser
                              ? 'bg-sky-50/50 border-t border-slate-100'
                              : 'border-t border-slate-100'
                        }
                      >
                        <td className="px-3 py-2 tabular-nums">{row.rank}º</td>
                        <td className="px-3 py-2">
                          {row.fullName}
                          {row.isCurrentAttempt
                            ? ' (esta partida)'
                            : row.isCurrentUser
                              ? ' (você)'
                              : ''}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                          {formatDateTime(row.completedAt)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{row.score}</td>
                        <td className="px-3 py-2 tabular-nums">{row.points}</td>
                        <td className="px-3 py-2 tabular-nums">{row.hits}</td>
                        <td className="px-3 py-2 tabular-nums">{row.misses}</td>
                        <td className="px-3 py-2 tabular-nums">{row.expired}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {row.accuracy.toFixed(1)}%
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatReactionMs(row.avgReactionMs)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{row.maxCombo}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showMeOutsideTop && (
                <div className="rounded-xl border-2 border-primary bg-sky-50 px-4 py-3">
                  <p className="text-sm font-semibold text-secondary mb-2">
                    Sua posição nesta partida
                  </p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-800">
                    <span>
                      <strong>{ranking.me.rank}º</strong> lugar
                    </span>
                    <span>{formatDateTime(ranking.me.completedAt)}</span>
                    <span>Nota: {ranking.me.score}</span>
                    <span>Pontos: {ranking.me.points}</span>
                    <span>Acertos: {ranking.me.hits}</span>
                    <span>Erros: {ranking.me.misses}</span>
                    <span>Sumiram: {ranking.me.expired}</span>
                    <span>Precisão: {ranking.me.accuracy.toFixed(1)}%</span>
                    <span>Reação: {formatReactionMs(ranking.me.avgReactionMs)}</span>
                  </div>
                </div>
              )}

              {!showMeOutsideTop && ranking.me.rank <= 10 && (
                <p className="text-sm text-slate-600">
                  Esta partida está em destaque na tabela acima na posição{' '}
                  <strong className="text-secondary">{ranking.me.rank}º</strong>.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  emphasize,
}: {
  label: string
  value: string
  emphasize?: boolean
}) {
  return (
    <div
      className={`rounded-lg border px-3 py-3 text-center ${
        emphasize ? 'border-primary bg-sky-50' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div
        className={`mt-1 font-bold tabular-nums ${
          emphasize ? 'text-2xl text-primary' : 'text-lg text-secondary'
        }`}
      >
        {value}
      </div>
    </div>
  )
}
