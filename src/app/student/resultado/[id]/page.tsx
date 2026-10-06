'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Card, { CardContent, CardHeader, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { CheckCircle2, XCircle, Award, ArrowLeft, BookOpen, Clock } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils'

export default function ResultadoPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [passingScore, setPassingScore] = useState(70)

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/assessments/${id}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar resultado')
        const payload = await res.json()
        const assessment = payload.assessment ?? payload

        if (assessment.status === 'IN_PROGRESS') {
          router.replace(`/student/avaliacao/${id}`)
          return
        }

        if (assessment.status === 'CANCELLED') {
          setResult(assessment)
          return
        }

        setResult(assessment)

        const type = assessment.type === 'PROVA' ? 'PROVA' : 'SIMULADO'
        const elig = await fetch(`/api/assessments/check-eligibility?type=${type}`, {
          cache: 'no-store',
        })
        if (elig.ok) {
          const data = await elig.json()
          const p = Number(data.passingScore)
          if (Number.isFinite(p)) setPassingScore(p)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchResult()
  }, [id, router])

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
                  <Clock className="w-12 h-12 text-amber-600 mx-auto" />
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
              ? 'AGUARDANDO CORREÇÃO'
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
              ? 'As questões de múltipla escolha já foram corrigidas. As discursivas serão avaliadas pelo administrador; a nota final sai depois disso.'
              : isApproved
                ? 'Parabéns! Você alcançou a nota necessária.'
                : `Você não alcançou a nota mínima de ${passingScore}%.`}
          </p>
        </CardHeader>

        <CardContent className="pt-8">
          <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
              <div className="text-sm font-medium text-slate-500 uppercase mb-1">
                Acertos (objetivas)
              </div>
              <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-6 h-6" /> {correctAnswers}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
              <div className="text-sm font-medium text-slate-500 uppercase mb-1">
                Erros (objetivas)
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
          {isFinal && result.type === 'SIMULADO' && (
            <Button onClick={() => router.push(`/student/revisao/${id}`)}>
              <BookOpen className="w-4 h-4 mr-2" /> Ver respostas e explicações
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
              Corrigidas automaticamente ao enviar a avaliação.
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
                ? 'Aguardando correção do administrador.'
                : 'Notas atribuídas pelo administrador.'}
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
                      ? 'Pendente'
                      : `${Math.round(d.scorePercent ?? 0)}%`}
                  </Badge>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap">
                  <span className="font-medium text-slate-700">Sua resposta: </span>
                  {d.studentAnswer?.trim() || '(em branco)'}
                </p>
                {!d.pending && d.feedback ? (
                  <p className="text-sm text-slate-600">
                    <span className="font-medium text-slate-700">Feedback: </span>
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
