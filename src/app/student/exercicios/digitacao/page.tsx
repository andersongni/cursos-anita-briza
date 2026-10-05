'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Trophy, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import Button from '@/components/ui/Button'
import Card, { CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import TypingPractice from '@/components/exercises/TypingPractice'
import { formatDurationMs } from '@/lib/exercises/typing'
import { formatDateTime } from '@/lib/utils'

type Passage = { id: string; title: string; content: string; charCount: number }

type AttemptResult = {
  id: string
  durationMs: number
  errorCount: number
  charsTotal: number
  wpm: number
  accuracy: number
  score: number
}

type RankingRow = {
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
  completedAt: string
  isCurrentUser: boolean
  isCurrentAttempt: boolean
}

type RankingPayload = {
  top: RankingRow[]
  me: RankingRow
  totalAttempts: number
}

export default function DigitacaoPage() {
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [passage, setPassage] = useState<Passage | null>(null)
  const [attempt, setAttempt] = useState<AttemptResult | null>(null)
  const [ranking, setRanking] = useState<RankingPayload | null>(null)
  const [runKey, setRunKey] = useState(0)
  const [accessError, setAccessError] = useState<string | null>(null)

  const loadPassage = useCallback(async () => {
    setLoading(true)
    setAttempt(null)
    setRanking(null)
    setAccessError(null)
    try {
      const res = await fetch('/api/exercises/typing/start', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) {
        const msg = data.error || 'Não foi possível carregar o texto'
        if (res.status === 403) {
          setAccessError(msg)
          return
        }
        throw new Error(msg)
      }
      setPassage(data.passage)
      setRunKey((k) => k + 1)
    } catch (e: unknown) {
      setPassage(null)
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar exercício')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPassage()
  }, [loadPassage])

  const handleComplete = async (payload: {
    passageId: string
    durationMs: number
    errorCount: number
  }) => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/exercises/typing/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar resultado')
      setAttempt(data.attempt)
      setRanking(data.ranking)
      toast.success('Prática concluída!')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar resultado')
    } finally {
      setSubmitting(false)
    }
  }

  const showMeOutsideTop =
    ranking != null &&
    ranking.me.rank > 10 &&
    !ranking.top.some((r) => r.isCurrentAttempt)

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/student/exercicios"
            className="inline-flex items-center text-sm text-accent hover:text-secondary mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar aos exercícios
          </Link>
          <h1 className="text-3xl font-bold text-secondary">Prática de digitação</h1>
          <p className="text-slate-600 mt-1">
            Digite o texto em português com precisão. O tempo é medido, sem limite para terminar.
          </p>
        </div>
        {attempt && (
          <Button variant="outline" onClick={() => void loadPassage()} disabled={loading || submitting}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Nova prática
          </Button>
        )}
      </div>

      {loading && (
        <div className="flex justify-center py-16">
          <Spinner size="lg" />
        </div>
      )}

      {!loading && !passage && !attempt && (
        <Card>
          <CardContent className="py-8 text-center space-y-4">
            <p className="text-slate-600">
              {accessError || 'Nenhum texto disponível no momento.'}
            </p>
            {accessError ? (
              <Link href="/student/matriculas">
                <Button variant="primary">Ver matrículas</Button>
              </Link>
            ) : (
              <Button onClick={() => void loadPassage()}>Tentar novamente</Button>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && passage && !attempt && (
        <Card padding="lg">
          <TypingPractice
            key={runKey}
            passageId={passage.id}
            title={passage.title}
            content={passage.content}
            onComplete={(r) => void handleComplete(r)}
            submitting={submitting}
          />
          {submitting && (
            <p className="mt-4 text-sm text-slate-500 flex items-center gap-2">
              <Spinner size="sm" /> Salvando resultado e carregando ranking…
            </p>
          )}
        </Card>
      )}

      {attempt && ranking && (
        <div className="space-y-6">
          <Card className="border-t-4 border-t-brand-gold">
            <CardHeader>
              <CardTitle className="text-2xl text-secondary">Seu resultado</CardTitle>
              <p className="text-slate-600 mt-1">
                Texto: <strong>{passage?.title}</strong>
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <Stat label="Nota" value={`${attempt.score}`} emphasize />
                <Stat label="Tempo" value={formatDurationMs(attempt.durationMs)} />
                <Stat label="Erros" value={String(attempt.errorCount)} />
                <Stat label="Precisão" value={`${attempt.accuracy.toFixed(1)}%`} />
                <Stat label="PPM" value={attempt.wpm.toFixed(1)} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trophy className="w-6 h-6 text-brand-gold-dark" />
                <CardTitle className="text-2xl text-secondary">Ranking — melhores tempos</CardTitle>
              </div>
              <p className="text-slate-600 mt-1">
                Top 10 de todas as práticas de digitação · {ranking.totalAttempts} registrada
                {ranking.totalAttempts === 1 ? '' : 's'} (inclui tentativas anteriores do mesmo aluno)
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-left text-slate-600">
                    <tr>
                      <th className="px-3 py-2 font-medium">#</th>
                      <th className="px-3 py-2 font-medium">Aluno</th>
                      <th className="px-3 py-2 font-medium">Texto</th>
                      <th className="px-3 py-2 font-medium">Data e hora</th>
                      <th className="px-3 py-2 font-medium">Tempo</th>
                      <th className="px-3 py-2 font-medium">Erros</th>
                      <th className="px-3 py-2 font-medium">PPM</th>
                      <th className="px-3 py-2 font-medium">Nota</th>
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
                            ? ' (esta prática)'
                            : row.isCurrentUser
                              ? ' (você)'
                              : ''}
                        </td>
                        <td className="px-3 py-2 max-w-[10rem] truncate" title={row.passageTitle}>
                          {row.passageTitle}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600">
                          {formatDateTime(row.completedAt)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">
                          {formatDurationMs(row.durationMs)}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{row.errorCount}</td>
                        <td className="px-3 py-2 tabular-nums">{row.wpm.toFixed(1)}</td>
                        <td className="px-3 py-2 tabular-nums">{row.score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {showMeOutsideTop && (
                <div className="rounded-xl border-2 border-primary bg-sky-50 px-4 py-3">
                  <p className="text-sm font-semibold text-secondary mb-2">Sua posição nesta prática</p>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-800">
                    <span>
                      <strong>{ranking.me.rank}º</strong> lugar
                    </span>
                    {ranking.me.passageTitle ? <span>Texto: {ranking.me.passageTitle}</span> : null}
                    <span>{formatDateTime(ranking.me.completedAt)}</span>
                    <span>Tempo: {formatDurationMs(ranking.me.durationMs)}</span>
                    <span>Erros: {ranking.me.errorCount}</span>
                    <span>PPM: {ranking.me.wpm.toFixed(1)}</span>
                    <span>Nota: {ranking.me.score}</span>
                  </div>
                </div>
              )}

              {!showMeOutsideTop && ranking.me.rank <= 10 && (
                <p className="text-sm text-slate-600">
                  Esta prática está em destaque na tabela acima na posição{' '}
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
