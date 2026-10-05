'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Clock, HelpCircle, FileText, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SimuladoStartPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [enrolled, setEnrolled] = useState(true)
  const [courseName, setCourseName] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState<string | null>(null)
  const [inProgressId, setInProgressId] = useState<string | null>(null)
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(120)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/assessments/check-eligibility?type=SIMULADO', {
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          setEnrolled(false)
          setBlockReason(data.error || 'Não foi possível verificar o simulado.')
          return
        }
        setEnrolled(data.enrolled !== false)
        setCourseName(typeof data.courseName === 'string' ? data.courseName : null)
        setBlockReason(typeof data.reason === 'string' ? data.reason : null)
        if (data.inProgressId) setInProgressId(data.inProgressId)
        const q = Number(data.questionCount)
        const t = Number(data.timeLimitMinutes)
        if (Number.isFinite(q) && q > 0) setQuestionCount(q)
        if (Number.isFinite(t) && t > 0) setTimeLimitMinutes(t)
      } catch {
        setEnrolled(false)
        setBlockReason('Erro ao verificar disponibilidade do simulado.')
      } finally {
        setChecking(false)
      }
    }
    void check()
  }, [])

  const handleStart = async () => {
    if (!enrolled) {
      toast.error(blockReason || 'Matrícula ativa necessária para iniciar o simulado.')
      return
    }
    if (inProgressId) {
      router.push(`/student/avaliacao/${inProgressId}`)
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/assessments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'SIMULADO' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao criar simulado')
      const id = data.id || data.assessment_id
      if (!id) throw new Error('Resposta inválida do servidor')
      router.push(`/student/avaliacao/${id}`)
    } catch (error: unknown) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro ao iniciar o simulado. Tente novamente.'
      )
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="p-8 text-center text-slate-500">Verificando disponibilidade do simulado...</div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="text-center pb-8 border-b border-slate-100">
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              enrolled ? 'bg-sky-100' : 'bg-slate-100'
            }`}
          >
            {enrolled ? (
              <FileText className="w-8 h-8 text-accent" />
            ) : (
              <Lock className="w-8 h-8 text-slate-500" />
            )}
          </div>
          <CardTitle className="text-3xl font-bold text-secondary">Simulado</CardTitle>
          <CardDescription className="text-lg mt-2 text-slate-600">
            {enrolled
              ? 'Prepare-se para a prova oficial testando seus conhecimentos.'
              : 'Matrícula ativa necessária para realizar o simulado deste curso.'}
          </CardDescription>
          {courseName && enrolled && (
            <p className="text-sm text-slate-500 mt-2">Curso: {courseName}</p>
          )}
        </CardHeader>

        <CardContent className="py-8 space-y-6">
          {!enrolled ? (
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-center space-y-3">
              <p className="text-slate-700 font-medium">
                {blockReason ||
                  'Você não possui matrícula ativa neste curso. Solicite a matrícula e aguarde a aprovação.'}
              </p>
              <Link href="/student/matriculas">
                <Button variant="primary" size="sm">
                  Solicitar matrícula
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg flex-1 justify-center border border-slate-100">
                  <HelpCircle className="w-6 h-6 text-accent" />
                  <div>
                    <div className="font-semibold text-slate-800">
                      {questionCount != null ? `${questionCount} Questões` : '… Questões'}
                    </div>
                    <div className="text-sm text-slate-500">Múltipla escolha</div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg flex-1 justify-center border border-slate-100">
                  <Clock className="w-6 h-6 text-accent" />
                  <div>
                    <div className="font-semibold text-slate-800">Duração</div>
                    <div className="text-sm text-slate-500">
                      {timeLimitMinutes} minutos (cronometrado)
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-sky-50 p-6 rounded-lg border border-sky-100 mt-6 text-center">
                <h3 className="font-semibold text-secondary mb-2">Instruções</h3>
                <p className="text-slate-700">
                  O simulado é uma ferramenta de estudo. Após finalizar, você poderá revisar suas
                  respostas e ver as explicações detalhadas para cada questão. O resultado não afeta
                  sua nota final.
                </p>
              </div>

              {inProgressId && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-center text-sm">
                  Você já tem um simulado em andamento. Clique abaixo para continuar.
                </div>
              )}
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-center pt-2 pb-8 border-t border-slate-100">
          <Button
            size="lg"
            className="w-full sm:w-auto px-12 py-6 text-lg rounded-full"
            onClick={handleStart}
            disabled={loading || !enrolled}
          >
            {loading
              ? 'Iniciando...'
              : !enrolled
                ? 'Sem matrícula'
                : inProgressId
                  ? 'Continuar Simulado'
                  : 'Iniciar Simulado'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
