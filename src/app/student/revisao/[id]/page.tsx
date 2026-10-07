'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Card from '@/components/ui/Card'
import Spinner from '@/components/ui/Spinner'
import { QuestionCard } from '@/components/assessment/QuestionCard'
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

type ReviewQuestion = {
  id: string
  question_order: number
  dimension_name_snapshot: string
  question_text_snapshot: string
  format?: string
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
}

type ReviewAnswer = {
  assessment_question_id: string
  selected_option: string | null
  text_answer?: string | null
  score_percent?: number | null
  grading_feedback?: string | null
  is_correct: boolean | null
}

function explanationFor(q: ReviewQuestion, key: string | null | undefined): string {
  if (!key) return ''
  const k = key.toLowerCase()
  const map: Record<string, string> = {
    a: q.option_a_explanation,
    b: q.option_b_explanation,
    c: q.option_c_explanation,
    d: q.option_d_explanation,
    e: q.option_e_explanation,
  }
  return map[k] || ''
}

export default function RevisaoSimuladoPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [questions, setQuestions] = useState<ReviewQuestion[]>([])
  const [answers, setAnswers] = useState<ReviewAnswer[]>([])
  const [score, setScore] = useState<number | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/assessments/${id}/review`, { cache: 'no-store' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Não foi possível carregar a revisão')

        const assessment = data.assessment
        setQuestions(assessment.questions ?? [])
        setAnswers(assessment.answers ?? [])
        setScore(assessment.score ?? null)
      } catch (e: any) {
        console.error(e)
        toast.error(e.message || 'Erro ao carregar revisão')
        router.replace(`/student/resultado/${id}`)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, router])

  const answerMap = useMemo(() => {
    const map = new Map<string, ReviewAnswer>()
    for (const a of answers) map.set(a.assessment_question_id, a)
    return map
  }, [answers])

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!questions.length) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <p className="text-slate-600">Nenhuma questão encontrada para revisão.</p>
        <Button onClick={() => router.push(`/student/resultado/${id}`)}>Voltar ao resultado</Button>
      </div>
    )
  }

  const q = questions[currentIndex]
  const ans = answerMap.get(q.id)
  const isDiscursive = q.format === 'DISCURSIVE'
  const selected = ans?.selected_option?.toLowerCase() ?? undefined
  const correct = q.correct_option?.toLowerCase()
  const scorePct = ans?.score_percent
  const acertou = isDiscursive
    ? (ans?.is_correct ?? (typeof scorePct === 'number' && scorePct >= 70))
    : (ans?.is_correct ?? (selected != null && selected === correct))
  const explanation = isDiscursive
    ? ans?.grading_feedback ||
      (typeof scorePct === 'number'
        ? `Nota desta questão: ${Math.round(scorePct)}%.`
        : 'Sem feedback de correção.')
    : explanationFor(q, correct) ||
      explanationFor(q, selected) ||
      'Sem explicação cadastrada para esta questão.'

  const options = isDiscursive
    ? []
    : [
        { id: 'a', label: 'A', text: q.option_a_text },
        { id: 'b', label: 'B', text: q.option_b_text },
        { id: 'c', label: 'C', text: q.option_c_text },
        { id: 'd', label: 'D', text: q.option_d_text },
        { id: 'e', label: 'E', text: q.option_e_text },
      ]

  return (
    <div className="max-w-3xl mx-auto py-6 px-4 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => router.push(`/student/resultado/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Resultado
        </Button>
        <div className="flex items-center gap-2">
          <Badge variant="info">Revisão — múltipla escolha</Badge>
          {score != null && (
            <Badge variant="outline">{Math.round(score)}%</Badge>
          )}
        </div>
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="text-sm text-slate-600">
            Questão {currentIndex + 1} de {questions.length}
            {q.dimension_name_snapshot ? (
              <span className="text-slate-400"> · {q.dimension_name_snapshot}</span>
            ) : null}
          </div>
          {acertou ? (
            <span className="inline-flex items-center gap-1 text-green-700 font-semibold text-sm">
              <CheckCircle2 className="w-4 h-4" />{' '}
              {isDiscursive
                ? `Nota ${Math.round(scorePct ?? 0)}%`
                : 'Você acertou'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-red-700 font-semibold text-sm">
              <XCircle className="w-4 h-4" />{' '}
              {isDiscursive
                ? `Nota ${Math.round(scorePct ?? 0)}%`
                : 'Você errou'}
              {!isDiscursive && !selected && (
                <span className="font-normal text-slate-500">(em branco)</span>
              )}
              {isDiscursive && !ans?.text_answer?.trim() && (
                <span className="font-normal text-slate-500">(em branco)</span>
              )}
            </span>
          )}
        </div>

        <QuestionCard
          questionNumber={q.question_order || currentIndex + 1}
          text={q.question_text_snapshot}
          format={isDiscursive ? 'DISCURSIVE' : 'MULTIPLE_CHOICE'}
          options={options}
          selectedOption={selected}
          textAnswer={ans?.text_answer ?? ''}
          correctOption={correct}
          showResult
          readOnly
          explanation={explanation}
        />
      </Card>

      <div className="flex justify-between items-center gap-2">
        <Button
          variant="outline"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Anterior
        </Button>

        <div className="flex flex-wrap justify-center gap-1.5 max-w-md">
          {questions.map((item, idx) => {
            const a = answerMap.get(item.id)
            const sel = a?.selected_option?.toLowerCase()
            const ok =
              item.format === 'DISCURSIVE'
                ? (a?.is_correct ??
                  (typeof a?.score_percent === 'number' && a.score_percent >= 70))
                : (a?.is_correct ??
                  (sel != null && sel === item.correct_option?.toLowerCase()))
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                className={`w-8 h-8 rounded-md text-xs font-medium border ${
                  idx === currentIndex
                    ? 'ring-2 ring-blue-500 ring-offset-1'
                    : ''
                } ${
                  ok
                    ? 'bg-green-100 border-green-300 text-green-800'
                    : 'bg-red-100 border-red-300 text-red-800'
                }`}
                title={`Questão ${idx + 1}`}
              >
                {idx + 1}
              </button>
            )
          })}
        </div>

        <Button
          variant="outline"
          disabled={currentIndex >= questions.length - 1}
          onClick={() => setCurrentIndex((i) => Math.min(questions.length - 1, i + 1))}
        >
          Próxima <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  )
}
