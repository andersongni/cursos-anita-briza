'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Card, { CardContent, CardHeader, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { CheckCircle2, XCircle, Award, ArrowLeft, BookOpen, Clock, Loader2 } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils'
import toast from 'react-hot-toast'

type GradingInfo = {
  pendingDiscursive: number
  estimatedSeconds: number
  estimatedSecondsRemaining: number
  etaLabel: string
  sampleCount: number
}

export default function ResultadoPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [grading, setGrading] = useState<GradingInfo | null>(null)
  const [passingScore, setPassingScore] = useState(70)
  const wasAwaitingRef = useRef(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const applyAssessment = useCallback(
    (assessment: any, gradingPayload: GradingInfo | null | undefined) => {
      if (assessment.status === 'IN_PROGRESS') {
        router.replace(`/student/avaliacao/${id}`)
        return assessment.status as string
      }

      if (
        wasAwaitingRef.current &&
        assessment.status === 'COMPLETED'
      ) {
        toast.success('Correção concluída! Confira seu resultado.')
        wasAwaitingRef.current = false
      }

      if (assessment.status === 'AWAITING_GRADING') {
        wasAwaitingRef.current = true
      }

      setResult(assessment)
      setGrading(
        assessment.status === 'AWAITING_GRADING' ? gradingPayload ?? null : null
      )
      return assessment.status as string
    },
    [id, router]
  )

  const fetchResult = useCallback(
    async (opts?: { silent?: boolean }) => {
      try {
        const res = await fetch(`/api/assessments/${id}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar resultado')
        const payload = await res.json()
        const assessment = payload.assessment ?? payload
        const status = applyAssessment(assessment, payload.grading)

        if (!opts?.silent) {
          const type = assessment.type === 'PROVA' ? 'PROVA' : 'SIMULADO'
          const elig = await fetch(
            `/api/assessments/check-eligibility?type=${type}`,
            { cache: 'no-store' }
          )
          if (elig.ok) {
            const data = await elig.json()
            const p = Number(data.passingScore)
            if (Number.isFinite(p)) setPassingScore(p)
          }
        }

        return status
      } catch (error) {
        console.error(error)
        return null
      } finally {
        if (!opts?.silent) setLoading(false)
      }
    },
    [applyAssessment, id]
  )

  useEffect(() => {
    let cancelled = false

    const start = async () => {
      const status = await fetchResult()
      if (cancelled) return

      if (status === 'AWAITING_GRADING') {
        pollRef.current = setInterval(() => {
          void fetchResult({ silent: true })
        }, 3000)
      }
    }

    void start()

    const onFocus = () => {
      void fetchResult({ silent: true })
    }
    window.addEventListener('focus', onFocus)

    return () => {
      cancelled = true
      if (pollRef.current) clearInterval(pollRef.current)
      window.removeEventListener('focus', onFocus)
    }
  }, [fetchResult])

  // Para o polling quando sair de AWAITING_GRADING
  useEffect(() => {
    if (result?.status && result.status !== 'AWAITING_GRADING' && pollRef.current) {
      clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [result?.status])

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!result) {
    return <div className="p-8 text-center text-slate-500">Erro ao carregar resultado.</div>
  }

  if (result.status === 'CANCELLED') {
    const home =
      result.type === 'PROVA' ? '/student/prova' : '/student/simulado'
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <p className="text-slate-700 text-lg font-medium">Avaliação abortada</p>
        <p className="text-slate-600">
          Esta {result.type === 'PROVA' ? 'prova' : 'simulado'} foi cancelada e não foi corrigida.
        </p>
        <Button onClick={() => router.push(home)}>Voltar</Button>
      </div>
    )
  }

  const totalQuestions = result.total_questions || result.questions?.length || 0
  if (totalQuestions === 0) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <p className="text-slate-600">
          Esta avaliação está inválida (sem questões). Inicie um novo simulado ou prova.
        </p>
        <Button onClick={() => router.push('/dashboard')}>Voltar ao início</Button>
      </div>
    )
  }

  const awaitingGrading = result.status === 'AWAITING_GRADING'
  const isApproved = !awaitingGrading && !!result.passed
  const isFinal = result.status === 'COMPLETED'
  const correctAnswers = result.correct_count ?? 0
  const wrongAnswers = result.wrong_count ?? 0

  type AnswerRow = {
    assessment_question_id: string
    selected_option?: string | null
    text_answer?: string | null
    score_percent?: number | null
    grading_feedback?: string | null
    is_correct?: boolean | null
  }

  const questions = result.questions ?? []
  const answers: AnswerRow[] = result.answers ?? []
  const answerByQ = new Map<string, AnswerRow>(
    answers.map((a) => [a.assessment_question_id, a])
  )

  const mcResults = questions
    .filter((q: any) => q.format !== 'DISCURSIVE')
    .map((q: any) => {
      const ans = answerByQ.get(q.id)
      return {
        id: q.id,
        order: q.question_order,
        text: q.question_text_snapshot as string,
        correct: !!ans?.is_correct,
        scorePercent:
          typeof ans?.score_percent === 'number' ? ans.score_percent : null,
      }
    })

  const hasMcReview = isFinal && mcResults.length > 0

  const discursiveResults = questions
    .filter((q: any) => q.format === 'DISCURSIVE')
    .map((q: any) => {
      const ans = answerByQ.get(q.id)
      const graded = typeof ans?.score_percent === 'number'
      return {
        id: q.id,
        order: q.question_order,
        text: q.question_text_snapshot as string,
        studentAnswer: ans?.text_answer || '',
        scorePercent: graded ? ans!.score_percent : null,
        feedback: graded ? ans?.grading_feedback || '' : '',
        pending: !graded,
      }
    })

  const pendingDiscursive = discursiveResults.filter((d) => d.pending).length
  const etaLabel =
    grading?.etaLabel ||
    (pendingDiscursive > 0 ? 'alguns instantes' : null)

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <Card
        className={`border-2 shadow-lg ${
          awaitingGrading
            ? 'border-amber-200'
            : isApproved
              ? 'border-green-200'
              : 'border-red-200'
        }`}
      >
        <CardHeader
          className={`text-center pb-8 ${
            awaitingGrading
              ? 'bg-amber-50'
              : isApproved
                ? 'bg-green-50'
                : 'bg-red-50'
          } rounded-t-xl`}
        >
          <Badge className="mx-auto mb-4" variant={result.type === 'PROVA' ? 'error' : 'info'}>
            {result.type === 'PROVA' ? 'Prova Oficial' : 'Simulado'}
          </Badge>

          <div className="flex justify-center mb-6">
            <div
              className={`relative w-40 h-40 rounded-full flex items-center justify-center border-8 ${
                awaitingGrading
                  ? 'border-amber-500'
                  : isApproved
                    ? 'border-green-500'
                    : 'border-red-500'
              } bg-white shadow-inner`}
            >
              <div className="text-center px-2">
                {awaitingGrading ? (
                  <Loader2 className="w-12 h-12 text-amber-600 mx-auto animate-spin" />
                ) : (
                  <span
                    className={`text-5xl font-bold ${
                      isApproved ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {Math.round(result.score || 0)}%
                  </span>
                )}
              </div>
            </div>
          </div>

          <h2
            className={`text-3xl font-bold ${
              awaitingGrading
                ? 'text-amber-800'
                : isApproved
                  ? 'text-green-800'
                  : 'text-red-800'
            }`}
          >
            {awaitingGrading
              ? 'EM PROCESSAMENTO'
              : isApproved
                ? 'APROVADO'
                : 'REPROVADO'}
          </h2>
          <p
            className={`mt-2 text-lg ${
              awaitingGrading
                ? 'text-amber-700'
                : isApproved
                  ? 'text-green-700'
                  : 'text-red-700'
            }`}
          >
            {awaitingGrading
              ? `As questões de múltipla escolha já foram corrigidas. As discursivas estão sendo analisadas${
                  etaLabel ? ` — tempo estimado: ${etaLabel}` : ''
                }.`
              : isApproved
                ? 'Parabéns! Você alcançou a nota necessária.'
                : `Você não alcançou a nota mínima de ${passingScore}%.`}
          </p>
          {awaitingGrading ? (
            <p className="mt-3 text-sm text-amber-600 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Esta página atualiza sozinha quando a correção terminar.
            </p>
          ) : null}
        </CardHeader>

        <CardContent className="pt-8">
          <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
              <div className="text-sm font-medium text-slate-500 uppercase mb-1">
                Acertos (múltipla escolha)
              </div>
              <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-6 h-6" /> {correctAnswers}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
              <div className="text-sm font-medium text-slate-500 uppercase mb-1">
                Erros (múltipla escolha)
              </div>
              <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-2">
                <XCircle className="w-6 h-6" /> {wrongAnswers}
              </div>
            </div>
          </div>

          {result.duration_seconds != null && (
            <p className="text-center text-sm text-slate-500 mt-6">
              Duração: {formatDuration(result.duration_seconds)}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pb-8">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao início
          </Button>
          {isFinal && hasMcReview && (
            <Button onClick={() => router.push(`/student/revisao/${id}`)}>
              <BookOpen className="w-4 h-4 mr-2" /> Revisar múltipla escolha
            </Button>
          )}
          {isFinal && result.type === 'PROVA' && isApproved && (
            <Button onClick={() => router.push('/student/certificados')}>
              <Award className="w-4 h-4 mr-2" /> Certificado
            </Button>
          )}
        </CardFooter>
      </Card>

      {mcResults.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <h3 className="text-lg font-semibold text-secondary">
              Múltipla escolha
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Corrigidas ao enviar a avaliação.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {mcResults.map((q: any) => (
              <div
                key={q.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2"
              >
                <p className="text-sm text-slate-700 min-w-0">
                  <span className="font-medium">{q.order}. </span>
                  {q.text}
                </p>
                {q.correct ? (
                  <span className="shrink-0 text-green-700 text-sm font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Certo
                  </span>
                ) : (
                  <span className="shrink-0 text-red-700 text-sm font-semibold flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> Errado
                  </span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {discursiveResults.length > 0 && (
        <Card className="border border-slate-200 shadow-sm">
          <CardHeader>
            <h3 className="text-lg font-semibold text-secondary">
              Questões discursivas
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              {awaitingGrading
                ? pendingDiscursive > 0
                  ? `Em análise (${pendingDiscursive} pendente${pendingDiscursive === 1 ? '' : 's'})${
                      etaLabel ? ` · ${etaLabel}` : ''
                    }.`
                  : 'Finalizando nota…'
                : 'Corrigidas automaticamente após o envio.'}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {discursiveResults.map((d: any) => (
              <div
                key={d.id}
                className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-medium text-slate-800">
                    {d.order != null ? `${d.order}. ` : ''}
                    {d.text}
                  </p>
                  <Badge variant={d.pending ? 'warning' : 'info'}>
                    {d.pending
                      ? 'Em processamento'
                      : `${Math.round(d.scorePercent ?? 0)}%`}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  <span className="font-medium text-slate-700">Sua resposta: </span>
                  {d.studentAnswer?.trim() || '(em branco)'}
                </p>
                {!d.pending && d.feedback ? (
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Comentário: </span>
                    {d.feedback}
                  </p>
                ) : null}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
