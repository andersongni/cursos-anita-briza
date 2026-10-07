'use client'

import { useCallback, useEffect, useState } from 'react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import Link from 'next/link'
import { formatDateTime, formatDuration } from '@/lib/utils'
import { Check, X } from 'lucide-react'
import { useParams } from 'next/navigation'
import toast from 'react-hot-toast'

type AssessmentDetail = {
  id: string
  type: string
  attempt_number: number
  started_at: string
  score: number | null
  passed: boolean | null
  status: string
  duration_seconds: number | null
  total_questions: number
  student?: { full_name: string }
  questions: Array<{
    id: string
    question_order: number
    dimension_name_snapshot: string
    question_text_snapshot: string
    format?: string
    expected_answer_snapshot?: string | null
    option_a_text: string
    option_b_text: string
    option_c_text: string
    option_d_text: string
    option_e_text: string
    option_a_explanation: string
    option_b_explanation: string
    option_c_explanation: string
    option_d_explanation: string
    option_e_explanation: string
    correct_option: string
  }>
  answers: Array<{
    assessment_question_id: string
    selected_option: string | null
    text_answer?: string | null
    score_percent?: number | null
    grading_feedback?: string | null
    is_correct: boolean | null
  }>
}

export default function AvaliacaoDetalhePage() {
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [av, setAv] = useState<AssessmentDetail | null>(null)
  const [scores, setScores] = useState<Record<string, string>>({})
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const res = await fetch(`/api/assessments/${params.id}`, { cache: 'no-store' })
    if (!res.ok) throw new Error('Avaliação não encontrada')
    const data = await res.json()
    const assessment = data.assessment as AssessmentDetail
    setAv(assessment)

    const nextScores: Record<string, string> = {}
    const nextFeedbacks: Record<string, string> = {}
    for (const a of assessment.answers ?? []) {
      if (typeof a.score_percent === 'number') {
        nextScores[a.assessment_question_id] = String(a.score_percent)
      }
      if (a.grading_feedback) {
        nextFeedbacks[a.assessment_question_id] = a.grading_feedback
      }
    }
    setScores(nextScores)
    setFeedbacks(nextFeedbacks)
  }, [params.id])

  useEffect(() => {
    const run = async () => {
      try {
        await load()
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar avaliação')
      } finally {
        setLoading(false)
      }
    }
    void run()
  }, [load])

  const saveDiscursiveGrade = async (questionId: string) => {
    const raw = scores[questionId]
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error('Informe uma nota entre 0 e 100')
      return
    }
    setSavingId(questionId)
    try {
      const res = await fetch(
        `/api/admin/assessments/${params.id}/grade-discursive`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            assessment_question_id: questionId,
            score_percent: n,
            grading_feedback: feedbacks[questionId] || '',
          }),
        }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar nota')
      toast.success(
        data.finalized
          ? 'Nota revisada. Nota final da prova atualizada.'
          : 'Nota salva. Ainda há discursivas pendentes.'
      )
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSavingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!av) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500">Avaliação não encontrada.</p>
        <Link href="/admin/avaliacoes">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    )
  }

  const resultado =
    av.status === 'AWAITING_GRADING'
      ? 'AGUARDANDO CORREÇÃO'
      : av.status !== 'COMPLETED'
        ? av.status
        : av.passed
          ? 'APROVADO'
          : 'REPROVADO'
  const answerMap = new Map(av.answers.map((a) => [a.assessment_question_id, a]))
  const canGrade =
    av.type === 'PROVA' &&
    (av.status === 'AWAITING_GRADING' || av.status === 'COMPLETED')

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <h1 className="text-3xl font-bold text-secondary">Detalhes da Avaliação</h1>
        <Link href="/admin/avaliacoes">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Resumo</CardTitle>
        </CardHeader>
        <div className="p-4 pt-0 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-500">Aluno</p>
            <p className="font-semibold">{av.student?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Tipo / Tentativa</p>
            <p>
              <Badge variant={av.type === 'PROVA' ? 'default' : 'info'}>{av.type}</Badge> #
              {av.attempt_number}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Data / Duração</p>
            <p>
              {formatDateTime(av.started_at)}
              {av.duration_seconds != null ? ` (${formatDuration(av.duration_seconds)})` : ''}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Nota / Resultado</p>
            <p className="font-bold text-lg">
              {av.score != null ? av.score.toFixed(1) : '—'} —{' '}
              <Badge
                variant={
                  resultado === 'APROVADO'
                    ? 'success'
                    : resultado === 'REPROVADO'
                      ? 'error'
                      : 'warning'
                }
              >
                {resultado}
              </Badge>
            </p>
          </div>
        </div>
        {canGrade && av.status === 'AWAITING_GRADING' && (
          <p className="px-4 pb-4 text-sm text-amber-800 bg-amber-50 border-t border-amber-100">
            Atribua a nota de cada discursiva (0–100). A nota final e a aprovação só são
            calculadas depois que todas forem corrigidas.
          </p>
        )}
        {canGrade && av.status === 'COMPLETED' && (
          <p className="px-4 pb-4 text-sm text-sky-900 bg-sky-50 border-t border-sky-100">
            Você pode revisar a nota e o comentário gerados automaticamente. Ao salvar, a
            nota final da prova é recalculada.
          </p>
        )}
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">
          Respostas ({av.questions.length} de {av.total_questions})
        </h2>

        {av.questions.length === 0 && (
          <p className="text-gray-500 text-sm">Nenhuma questão registrada nesta avaliação.</p>
        )}

        {av.questions.map((q) => {
          const ans = answerMap.get(q.id)
          const isDiscursive = q.format === 'DISCURSIVE'

          if (isDiscursive) {
            const graded = typeof ans?.score_percent === 'number'
            return (
              <Card
                key={q.id}
                className={`border-l-4 ${
                  graded ? 'border-l-sky-500' : 'border-l-amber-500'
                }`}
              >
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap justify-between gap-2 mb-1">
                    <Badge variant="outline">
                      Questão {q.question_order} — {q.dimension_name_snapshot} · Discursiva
                    </Badge>
                    <Badge variant={graded ? 'info' : 'warning'}>
                      {graded ? `${ans?.score_percent}%` : 'Pendente'}
                    </Badge>
                  </div>
                  <p className="font-medium">{q.question_text_snapshot}</p>
                  {q.expected_answer_snapshot ? (
                    <div className="rounded-md bg-slate-50 border border-slate-200 p-3 text-sm">
                      <p className="font-medium text-slate-700 mb-1">Critérios</p>
                      <p className="text-slate-600 whitespace-pre-wrap">
                        {q.expected_answer_snapshot}
                      </p>
                    </div>
                  ) : null}
                  <div className="rounded-md bg-white border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-700 mb-1">Resposta do aluno</p>
                    <p className="text-slate-800 whitespace-pre-wrap">
                      {ans?.text_answer?.trim() || '(em branco)'}
                    </p>
                  </div>
                  {canGrade || graded ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                      <Input
                        label="Nota (0–100)"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={scores[q.id] ?? ''}
                        disabled={!canGrade}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setScores((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                      />
                      <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Comentário (opcional)
                        </label>
                        <textarea
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[42px]"
                          value={feedbacks[q.id] ?? ''}
                          disabled={!canGrade}
                          onChange={(e) =>
                            setFeedbacks((prev) => ({
                              ...prev,
                              [q.id]: e.target.value,
                            }))
                          }
                        />
                      </div>
                      {canGrade && (
                        <div className="md:col-span-3 flex justify-end">
                          <Button
                            variant="primary"
                            loading={savingId === q.id}
                            onClick={() => void saveDiscursiveGrade(q.id)}
                          >
                            {av.status === 'COMPLETED'
                              ? 'Salvar revisão'
                              : 'Salvar nota'}
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </Card>
            )
          }

          const escolhida = ans?.selected_option?.toLowerCase() ?? null
          const correta = q.correct_option?.toLowerCase()
          const acertou = ans?.is_correct ?? (escolhida != null && escolhida === correta)
          const alternativas = [
            { id: 'a', texto: q.option_a_text, exp: q.option_a_explanation },
            { id: 'b', texto: q.option_b_text, exp: q.option_b_explanation },
            { id: 'c', texto: q.option_c_text, exp: q.option_c_explanation },
            { id: 'd', texto: q.option_d_text, exp: q.option_d_explanation },
            { id: 'e', texto: q.option_e_text, exp: q.option_e_explanation },
          ]
          const explicacao =
            alternativas.find((a) => a.id === correta)?.exp ||
            alternativas.find((a) => a.id === escolhida)?.exp ||
            ''

          return (
            <Card
              key={q.id}
              className={`border-l-4 ${acertou ? 'border-l-green-500' : 'border-l-red-500'}`}
            >
              <div className="p-4">
                <div className="flex justify-between mb-2">
                  <Badge variant="outline">
                    Questão {q.question_order} — {q.dimension_name_snapshot}
                  </Badge>
                  {acertou ? (
                    <span className="text-green-600 flex items-center font-semibold">
                      <Check size={16} className="mr-1" /> Acertou
                    </span>
                  ) : (
                    <span className="text-red-600 flex items-center font-semibold">
                      <X size={16} className="mr-1" /> Errou
                    </span>
                  )}
                </div>
                <p className="font-medium mb-4">{q.question_text_snapshot}</p>
                <div className="space-y-2 mb-4">
                  {alternativas.map((alt) => {
                    let altClass = 'p-2 border rounded-md text-sm '
                    if (alt.id === correta) altClass += 'bg-green-100 border-green-300 font-semibold'
                    else if (alt.id === escolhida && !acertou)
                      altClass += 'bg-red-100 border-red-300 line-through'
                    else altClass += 'bg-gray-50'

                    return (
                      <div key={alt.id} className={altClass}>
                        <span className="font-bold mr-2">{alt.id.toUpperCase()})</span>
                        {alt.texto}
                      </div>
                    )
                  })}
                </div>
                {explicacao ? (
                  <p className="text-sm text-slate-600">
                    <span className="font-medium">Explicação: </span>
                    {explicacao}
                  </p>
                ) : null}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
