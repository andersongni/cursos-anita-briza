'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { Timer } from '@/components/assessment/Timer'
import { QuestionCard } from '@/components/assessment/QuestionCard'
import { QuestionGrid } from '@/components/assessment/QuestionGrid'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { ChevronLeft, ChevronRight, CheckCircle, LayoutGrid, X, Ban } from 'lucide-react'

type UiQuestion = {
  id: string
  text: string
  options: { id: string; text: string; label: string }[]
}

function mapAssessmentQuestions(raw: any[]): UiQuestion[] {
  return (raw ?? []).map((q) => ({
    id: q.id,
    text: q.question_text_snapshot,
    options: [
      { id: 'a', label: 'A', text: q.option_a_text },
      { id: 'b', label: 'B', text: q.option_b_text },
      { id: 'c', label: 'C', text: q.option_c_text },
      { id: 'd', label: 'D', text: q.option_d_text },
      { id: 'e', label: 'E', text: q.option_e_text },
    ],
  }))
}

export default function AssessmentPage() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const id = params.id

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [assessment, setAssessment] = useState<any>(null)
  const [questions, setQuestions] = useState<UiQuestion[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [flagged, setFlagged] = useState<Set<string>>(new Set())
  const [mapOpen, setMapOpen] = useState(false)
  const [aborting, setAborting] = useState(false)

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const res = await fetch(`/api/assessments/${id}`)
        if (!res.ok) throw new Error('Falha ao carregar avaliação')

        const payload = await res.json()
        const data = payload.assessment ?? payload

        if (data.status !== 'IN_PROGRESS') {
          router.replace(`/student/resultado/${id}`)
          return
        }

        const mapped = mapAssessmentQuestions(data.questions)
        if (mapped.length === 0) {
          alert(
            'Esta avaliação não tem questões. Voltando para iniciar um novo simulado/prova.'
          )
          router.replace(
            data.type === 'PROVA' ? '/student/prova' : '/student/simulado'
          )
          return
        }

        setAssessment(data)
        setQuestions(mapped)

        const restoredAnswers: Record<string, string> = {}
        const restoredFlagged = new Set<string>()

        for (const ans of data.answers ?? []) {
          const qid = ans.assessment_question_id
          if (ans.selected_option) {
            restoredAnswers[qid] = String(ans.selected_option).toLowerCase()
          }
          if (ans.flagged_for_review) restoredFlagged.add(qid)
        }

        setAnswers(restoredAnswers)
        setFlagged(restoredFlagged)
      } catch (error) {
        console.error(error)
        alert('Erro ao carregar a avaliação. Tente atualizar a página.')
      } finally {
        setLoading(false)
      }
    }

    fetchAssessment()
  }, [id, router])

  const saveAnswer = async (
    questionId: string,
    selectedOption: string | undefined,
    isFlagged: boolean
  ) => {
    setSaving(true)
    try {
      await fetch('/api/assessments/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment_id: id,
          assessment_question_id: questionId,
          selected_option: selectedOption,
          flagged_for_review: isFlagged,
        }),
      })
    } catch (error) {
      console.error('Erro ao salvar resposta', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSelectOption = async (optionId: string) => {
    const questionId = questions[currentIndex].id
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }))
    await saveAnswer(questionId, optionId, flagged.has(questionId))
  }

  const handleToggleFlag = async () => {
    const questionId = questions[currentIndex].id
    const next = new Set(flagged)
    if (next.has(questionId)) next.delete(questionId)
    else next.add(questionId)
    setFlagged(next)
    await saveAnswer(questionId, answers[questionId], next.has(questionId))
  }

  const handleAbort = async () => {
    const label = assessment?.type === 'PROVA' ? 'prova' : 'simulado'
    const ok = window.confirm(
      `Deseja realmente abortar este ${label}?\n\nAs respostas não serão corrigidas e esta tentativa será cancelada.`
    )
    if (!ok) return

    setAborting(true)
    try {
      const res = await fetch('/api/assessments/abort', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_id: id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Não foi possível abortar')
      }
      router.replace(
        assessment?.type === 'PROVA' ? '/student/prova' : '/student/simulado'
      )
    } catch (error: any) {
      console.error(error)
      alert(error.message || 'Erro ao abortar a avaliação.')
      setAborting(false)
    }
  }

  const handleTimeUp = async () => {
    if (!questions.length) return
    alert('O tempo acabou! Suas respostas serão enviadas automaticamente.')
    try {
      const res = await fetch('/api/assessments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_id: id }),
      })
      if (!res.ok) {
        router.replace(
          assessment?.type === 'PROVA' ? '/student/prova' : '/student/simulado'
        )
        return
      }
      router.replace(`/student/resultado/${id}`)
    } catch (error) {
      console.error('Erro no envio automático', error)
      router.replace('/dashboard')
    }
  }

  const gridQuestions = useMemo(
    () =>
      questions.map((q, idx) => ({
        id: q.id,
        number: idx + 1,
        isAnswered: !!answers[q.id],
        isFlagged: flagged.has(q.id),
      })),
    [questions, answers, flagged]
  )

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <Spinner size="lg" />
        <p className="mt-4 text-slate-500">Preparando sua avaliação...</p>
      </div>
    )
  }

  if (!assessment) {
    return <div className="p-8 text-center text-slate-500">Avaliação não encontrada.</div>
  }

  if (!questions.length) {
    return <div className="p-8 text-center text-slate-500">Nenhuma questão encontrada.</div>
  }

  const currentQuestion = questions[currentIndex]
  const isLastQuestion = currentIndex === questions.length - 1
  const deadline = assessment.deadline_at || assessment.deadlineAt
  const answeredCount = Object.keys(answers).length

  return (
    <div className="h-full max-w-7xl mx-auto flex flex-col overflow-hidden px-2 sm:px-3">
      {/* Barra superior fixa — compacta para liberar espaço ao texto grande */}
      <header className="shrink-0 py-1.5 flex flex-wrap items-center justify-between gap-1.5 border-b border-slate-200 bg-slate-50">
        <div className="flex items-center gap-2 min-w-0">
          <Badge
            variant={assessment.type === 'PROVA' ? 'error' : 'info'}
            className="text-xs px-2 py-0.5 shrink-0"
          >
            {assessment.type === 'PROVA' ? 'Prova' : 'Simulado'}
          </Badge>
          <span className="font-medium text-slate-600 text-xs sm:text-sm truncate">
            {currentIndex + 1}/{questions.length}
            <span className="hidden sm:inline text-slate-400 font-normal">
              {' '}
              · {answeredCount} resp.
            </span>
          </span>
          {saving && (
            <span className="text-xs text-slate-400 flex items-center gap-1 shrink-0">
              <Spinner size="sm" />
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="lg:hidden inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-slate-200 bg-white text-slate-600"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            Mapa
          </button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleAbort}
            disabled={aborting}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
            title="Abortar avaliação"
          >
            <Ban className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline text-xs">{aborting ? 'Abortando…' : 'Abortar'}</span>
          </Button>
          {deadline && <Timer deadline={deadline} onTimeUp={handleTimeUp} />}
        </div>
      </header>

      {/* Corpo: questão + mapa (desktop) */}
      <div className="flex-1 min-h-0 flex gap-2 sm:gap-3 py-1.5 overflow-hidden">
        <section className="flex-1 min-h-0 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 min-h-0 overflow-hidden">
            <QuestionCard
              compact
              questionNumber={currentIndex + 1}
              text={currentQuestion.text}
              options={currentQuestion.options}
              selectedOption={answers[currentQuestion.id]}
              onSelect={handleSelectOption}
              flaggedForReview={flagged.has(currentQuestion.id)}
              onToggleFlag={handleToggleFlag}
            />
          </div>

          <div className="shrink-0 flex justify-between items-center gap-2 pt-1.5 border-t border-slate-200 mt-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => setCurrentIndex((prev) => Math.max(0, prev - 1))}
              disabled={currentIndex === 0}
            >
              <ChevronLeft className="mr-1 w-4 h-4" /> Anterior
            </Button>

            {isLastQuestion ? (
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white h-8"
                onClick={() => router.push(`/student/avaliacao/${id}/resumo`)}
              >
                Revisão <CheckCircle className="ml-1 w-4 h-4" />
              </Button>
            ) : (
              <Button
                size="sm"
                className="h-8"
                onClick={() =>
                  setCurrentIndex((prev) => Math.min(questions.length - 1, prev + 1))
                }
              >
                Próxima <ChevronRight className="ml-1 w-4 h-4" />
              </Button>
            )}
          </div>
        </section>

        <aside className="hidden lg:flex w-56 xl:w-64 shrink-0 min-h-0 flex-col overflow-hidden">
          <QuestionGrid
            compact
            questions={gridQuestions}
            currentIndex={currentIndex}
            onSelect={setCurrentIndex}
          />
          <p className="mt-1 text-[10px] text-slate-500 text-center shrink-0">
            Salvo automaticamente
          </p>
        </aside>
      </div>

      {/* Mapa em overlay no mobile/tablet */}
      {mapOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col bg-black/40">
          <div className="mt-auto bg-white rounded-t-2xl max-h-[85dvh] flex flex-col p-3 shadow-xl">
            <div className="flex items-center justify-between mb-2 shrink-0">
              <h3 className="font-semibold text-slate-800">Mapa de Questões</h3>
              <button
                type="button"
                onClick={() => setMapOpen(false)}
                className="p-2 rounded-md text-slate-500 hover:bg-slate-100"
                aria-label="Fechar mapa"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto">
              <QuestionGrid
                compact
                questions={gridQuestions}
                currentIndex={currentIndex}
                onSelect={(idx) => {
                  setCurrentIndex(idx)
                  setMapOpen(false)
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
