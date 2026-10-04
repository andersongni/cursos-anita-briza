'use client'

import { useEffect, useState } from 'react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
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
    is_correct: boolean | null
  }>
}

export default function AvaliacaoDetalhePage() {
  const params = useParams<{ id: string }>()
  const [loading, setLoading] = useState(true)
  const [av, setAv] = useState<AssessmentDetail | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/assessments/${params.id}`)
        if (!res.ok) throw new Error('Avaliação não encontrada')
        const data = await res.json()
        setAv(data.assessment)
      } catch (e: any) {
        toast.error(e.message || 'Erro ao carregar avaliação')
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [params.id])

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
    av.status !== 'COMPLETED' ? av.status : av.passed ? 'APROVADO' : 'REPROVADO'
  const answerMap = new Map(av.answers.map((a) => [a.assessment_question_id, a]))

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
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
                        <span className="uppercase mr-2 font-bold">{alt.id})</span> {alt.texto}
                        {alt.id === escolhida && (
                          <span className="ml-2 text-xs font-bold text-gray-600">
                            (Resposta do Aluno)
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
                {explicacao && (
                  <div className="bg-sky-50 p-3 rounded-md text-sm">
                    <span className="font-semibold text-secondary">Explicação:</span> {explicacao}
                  </div>
                )}
              </div>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
