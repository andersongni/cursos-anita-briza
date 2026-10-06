'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Button from '@/components/ui/Button'
import Card, { CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/Card'
import Modal from '@/components/ui/Modal'
import { CheckCircle2, AlertTriangle, CircleDashed, ArrowLeft, Send, Ban } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

export default function ResumoPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [aborting, setAborting] = useState(false)
  const [showConfirmModal, setShowConfirmModal] = useState(false)
  const [assessmentType, setAssessmentType] = useState<'PROVA' | 'SIMULADO'>('SIMULADO')
  const [questions, setQuestions] = useState<{ id: string; text: string }[]>([])
  const [answers, setAnswers] = useState<
    {
      assessment_question_id: string
      selected_option: string | null
      text_answer?: string | null
      flagged_for_review: boolean
    }[]
  >([])
  const [questionFormats, setQuestionFormats] = useState<
    Record<string, string>
  >({})

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        const res = await fetch(`/api/assessments/${id}`)
        if (!res.ok) throw new Error('Falha ao carregar')
        const payload = await res.json()
        const assessment = payload.assessment ?? payload

        if (assessment.status !== 'IN_PROGRESS') {
          router.replace(`/student/resultado/${id}`)
          return
        }

        setAssessmentType(assessment.type === 'PROVA' ? 'PROVA' : 'SIMULADO')
        setQuestions(
          (assessment.questions ?? []).map((q: any) => ({
            id: q.id,
            text: q.question_text_snapshot,
          }))
        )
        const formats: Record<string, string> = {}
        for (const q of assessment.questions ?? []) {
          formats[q.id] =
            q.format === 'DISCURSIVE' ? 'DISCURSIVE' : 'MULTIPLE_CHOICE'
        }
        setQuestionFormats(formats)
        setAnswers(assessment.answers ?? [])
      } catch (error) {
        console.error(error)
        toast.error('Erro ao carregar resumo')
      } finally {
        setLoading(false)
      }
    }
    fetchAssessment()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const answerMap = new Map(answers.map((a) => [a.assessment_question_id, a]))

  const statusCounts = { answered: 0, flagged: 0, unanswered: 0 }

  const questionStatus = questions.map((q, idx) => {
    const ans = answerMap.get(q.id)
    const isDiscursive = questionFormats[q.id] === 'DISCURSIVE'
    const isAnswered = isDiscursive
      ? Boolean(ans?.text_answer?.trim())
      : !!ans?.selected_option
    const isFlagged = !!ans?.flagged_for_review

    if (!isAnswered) statusCounts.unanswered++
    else if (isFlagged) statusCounts.flagged++
    else statusCounts.answered++

    return { number: idx + 1, isAnswered, isFlagged }
  })

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/assessments/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_id: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao enviar')
      router.push(`/student/resultado/${id}`)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Erro ao finalizar avaliação.')
      setSubmitting(false)
      setShowConfirmModal(false)
    }
  }

  const handleAbort = async () => {
    const label = assessmentType === 'PROVA' ? 'prova' : 'simulado'
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
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Não foi possível abortar')
      router.replace(assessmentType === 'PROVA' ? '/student/prova' : '/student/simulado')
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Erro ao abortar avaliação.')
      setAborting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={() => router.push(`/student/avaliacao/${id}`)}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Voltar às questões
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Revisão antes de finalizar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="p-4 bg-green-50 rounded-lg border border-green-100">
              <CheckCircle2 className="w-6 h-6 text-green-600 mx-auto mb-1" />
              <div className="font-bold text-green-800">{statusCounts.answered}</div>
              <div className="text-xs text-green-700">Respondidas</div>
            </div>
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100">
              <AlertTriangle className="w-6 h-6 text-yellow-600 mx-auto mb-1" />
              <div className="font-bold text-yellow-800">{statusCounts.flagged}</div>
              <div className="text-xs text-yellow-700">Marcadas</div>
            </div>
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
              <CircleDashed className="w-6 h-6 text-slate-500 mx-auto mb-1" />
              <div className="font-bold text-slate-800">{statusCounts.unanswered}</div>
              <div className="text-xs text-slate-600">Em branco</div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {questionStatus.map((q) => (
              <button
                key={q.number}
                onClick={() => router.push(`/student/avaliacao/${id}`)}
                className={`w-10 h-10 rounded-md text-sm font-medium border ${
                  !q.isAnswered
                    ? 'bg-slate-100 border-slate-200 text-slate-600'
                    : q.isFlagged
                      ? 'bg-yellow-100 border-yellow-300 text-yellow-800'
                      : 'bg-green-100 border-green-300 text-green-800'
                }`}
              >
                {q.number}
              </button>
            ))}
          </div>
        </CardContent>
        <CardFooter className="justify-between gap-2 flex-wrap">
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleAbort}
            loading={aborting}
            disabled={submitting}
          >
            <Ban className="w-4 h-4 mr-2" /> Abortar
          </Button>
          <Button size="lg" onClick={() => setShowConfirmModal(true)} disabled={aborting}>
            <Send className="w-4 h-4 mr-2" /> Finalizar avaliação
          </Button>
        </CardFooter>
      </Card>

      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirmar envio"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Após finalizar, você não poderá alterar as respostas.
            {statusCounts.unanswered > 0
              ? ` Ainda há ${statusCounts.unanswered} questão(ões) em branco.`
              : ''}
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setShowConfirmModal(false)}>
              Cancelar
            </Button>
            <Button loading={submitting} onClick={handleSubmit}>
              Confirmar e enviar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
