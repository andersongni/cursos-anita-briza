'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import CompositionSummary from '@/components/assessment/CompositionSummary'
import { FileText, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SimuladoStartPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [enrolled, setEnrolled] = useState(true)
  const [courseName, setCourseName] = useState<string | null>(null)
  const [blockReason, setBlockReason] = useState<string | null>(null)
  const [inProgressId, setInProgressId] = useState<string | null>(null)
  const [awaitingGradingId, setAwaitingGradingId] = useState<string | null>(null)
  const [mcCount, setMcCount] = useState<number | null>(null)
  const [discursiveCount, setDiscursiveCount] = useState<number | null>(null)
  const [mcWeightPercent, setMcWeightPercent] = useState<number | null>(null)
  const [discursiveWeightPercent, setDiscursiveWeightPercent] = useState<number | null>(null)
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
        if (data.awaitingGradingId) setAwaitingGradingId(data.awaitingGradingId)
        const mc = Number(data.mcCount)
        const disc = Number(data.discursiveCount)
        const mcW = Number(data.mcWeightPercent)
        const discW = Number(data.discursiveWeightPercent)
        const t = Number(data.timeLimitMinutes)
        if (Number.isFinite(mc) && mc >= 0) setMcCount(mc)
        if (Number.isFinite(disc) && disc >= 0) setDiscursiveCount(disc)
        if (Number.isFinite(mcW)) setMcWeightPercent(mcW)
        if (Number.isFinite(discW)) setDiscursiveWeightPercent(discW)
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
    if (awaitingGradingId) {
      router.push(`/student/resultado/${awaitingGradingId}`)
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
      <div className="h-full flex items-center justify-center text-slate-500">
        Verificando disponibilidade do simulado...
      </div>
    )
  }

  const startLabel = loading
    ? 'Iniciando...'
    : !enrolled
      ? 'Sem matrícula'
      : inProgressId
        ? 'Continuar Simulado'
        : awaitingGradingId
          ? 'Ver resultado (aguardando correção)'
          : 'Iniciar Simulado'

  return (
    <div className="h-full flex items-center justify-center px-4 py-3 sm:px-6">
      <Card
        padding="sm"
        className="w-full max-w-4xl border-2 border-slate-200 shadow-md !p-0 overflow-hidden"
      >
        <CardHeader className="mb-0 px-5 sm:px-6 pt-5 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-4">
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                enrolled ? 'bg-sky-100' : 'bg-slate-100'
              }`}
            >
              {enrolled ? (
                <FileText className="w-6 h-6 text-accent" />
              ) : (
                <Lock className="w-6 h-6 text-slate-500" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <CardTitle className="text-2xl font-bold text-secondary">Simulado</CardTitle>
                {courseName && enrolled && (
                  <span className="text-sm text-slate-500">Curso: {courseName}</span>
                )}
              </div>
              <CardDescription className="text-base mt-1 text-slate-600">
                {enrolled
                  ? 'Prepare-se para a prova oficial testando seus conhecimentos.'
                  : 'Matrícula ativa necessária para realizar o simulado deste curso.'}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-5 sm:px-6 py-5 space-y-4">
          {!enrolled ? (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 px-4 py-3.5 rounded-xl border border-slate-200">
              <p className="flex-1 text-slate-700 font-medium text-sm sm:text-base leading-snug">
                {blockReason ||
                  'Você não possui matrícula ativa neste curso. Solicite a matrícula e aguarde a aprovação.'}
              </p>
              <Link href="/student/matriculas" className="shrink-0">
                <Button variant="primary" size="sm">
                  Solicitar matrícula
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <CompositionSummary
                mcCount={mcCount}
                discursiveCount={discursiveCount}
                mcWeightPercent={mcWeightPercent}
                discursiveWeightPercent={discursiveWeightPercent}
                timeLimitMinutes={timeLimitMinutes}
                accentClassName="text-accent"
              />

              {(inProgressId || awaitingGradingId) && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2.5 rounded-xl text-sm text-center sm:text-left">
                  {inProgressId
                    ? 'Você já tem um simulado em andamento. Clique ao lado para continuar.'
                    : 'Aguardando correção das discursivas. Clique ao lado para ver o resultado parcial.'}
                </div>
              )}
            </>
          )}
        </CardContent>

        {enrolled && (
          <CardFooter className="mt-0 flex flex-col sm:flex-row sm:items-center gap-4 px-5 sm:px-6 py-4 border-t border-slate-100 bg-sky-50/60">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-secondary mb-1">Instruções</h3>
              <p className="text-sm text-slate-700 leading-relaxed">
                O simulado é uma ferramenta de estudo. Após finalizar, você poderá revisar as
                objetivas e ver as explicações. A nota combina múltipla escolha e discursivas
                conforme os pesos acima e não afeta a nota final do curso.
              </p>
            </div>
            <Button
              size="lg"
              className="w-full sm:w-auto shrink-0 px-8 py-3.5 text-base rounded-full"
              onClick={handleStart}
              disabled={loading || !enrolled}
            >
              {startLabel}
            </Button>
          </CardFooter>
        )}

        {!enrolled && (
          <CardFooter className="mt-0 flex justify-center px-5 sm:px-6 py-4 border-t border-slate-100">
            <Button
              size="lg"
              className="w-full sm:w-auto px-8 py-3.5 text-base rounded-full"
              onClick={handleStart}
              disabled
            >
              {startLabel}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
