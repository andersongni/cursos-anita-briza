'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import CompositionSummary from '@/components/assessment/CompositionSummary'
import { AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
import toast from 'react-hot-toast'

function formatRemaining(ms: number): string {
  if (ms <= 0) return 'menos de 1 minuto'
  const totalMin = Math.ceil(ms / 60_000)
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h <= 0) return m === 1 ? '1 minuto' : `${m} minutos`
  if (m === 0) return h === 1 ? '1 hora' : `${h} horas`
  return `${h}h ${m}min`
}

export default function ProvaStartPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [enrolled, setEnrolled] = useState(true)
  const [courseName, setCourseName] = useState<string | null>(null)
  const [eligible, setEligible] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [unlockUntil, setUnlockUntil] = useState<string | null>(null)
  const [remainingMs, setRemainingMs] = useState(0)
  const [blockReason, setBlockReason] = useState<string | null>(null)
  const [inProgressId, setInProgressId] = useState<string | null>(null)
  const [awaitingGradingId, setAwaitingGradingId] = useState<string | null>(null)
  const [mcCount, setMcCount] = useState(40)
  const [discursiveCount, setDiscursiveCount] = useState(0)
  const [mcWeightPercent, setMcWeightPercent] = useState(80)
  const [discursiveWeightPercent, setDiscursiveWeightPercent] = useState(20)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(120)
  const [passingScore, setPassingScore] = useState(70)

  const loadEligibility = async () => {
    try {
      const res = await fetch('/api/assessments/check-eligibility?type=PROVA', {
        cache: 'no-store',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEnrolled(false)
        setEligible(false)
        setUnlocked(false)
        setBlockReason(data.error || 'Não foi possível verificar a prova.')
        return
      }
      setEnrolled(data.enrolled !== false)
      setCourseName(typeof data.courseName === 'string' ? data.courseName : null)
      setEligible(Boolean(data.eligible))
      setUnlocked(Boolean(data.unlocked))
      setUnlockUntil(typeof data.unlockUntil === 'string' ? data.unlockUntil : null)
      setRemainingMs(Number.isFinite(Number(data.remainingMs)) ? Number(data.remainingMs) : 0)
      setBlockReason(typeof data.reason === 'string' ? data.reason : null)
      setInProgressId(data.inProgressId ?? null)
      setAwaitingGradingId(data.awaitingGradingId ?? null)
      const mc = Number(data.mcCount)
      const disc = Number(data.discursiveCount)
      const mcW = Number(data.mcWeightPercent)
      const discW = Number(data.discursiveWeightPercent)
      const t = Number(data.timeLimitMinutes)
      const p = Number(data.passingScore)
      if (Number.isFinite(mc) && mc >= 0) setMcCount(mc)
      if (Number.isFinite(disc) && disc >= 0) setDiscursiveCount(disc)
      if (Number.isFinite(mcW)) setMcWeightPercent(mcW)
      if (Number.isFinite(discW)) setDiscursiveWeightPercent(discW)
      if (Number.isFinite(t) && t > 0) setTimeLimitMinutes(t)
      if (Number.isFinite(p) && p >= 0) setPassingScore(p)
    } catch (error) {
      console.error(error)
      setEnrolled(false)
      setBlockReason('Erro ao verificar disponibilidade da prova.')
    } finally {
      setChecking(false)
    }
  }

  useEffect(() => {
    void loadEligibility()
  }, [])

  useEffect(() => {
    if (!unlockUntil || !unlocked || !enrolled) return
    const id = setInterval(() => {
      const left = new Date(unlockUntil).getTime() - Date.now()
      if (left <= 0) {
        setUnlocked(false)
        setRemainingMs(0)
        if (!inProgressId) setEligible(false)
        void loadEligibility()
        return
      }
      setRemainingMs(left)
    }, 30_000)
    return () => clearInterval(id)
  }, [unlockUntil, unlocked, inProgressId, enrolled])

  const unlockLabel = useMemo(() => {
    if (!unlockUntil || !unlocked) return null
    const d = new Date(unlockUntil)
    if (Number.isNaN(d.getTime())) return null
    return d.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [unlockUntil, unlocked])

  const notEnrolled = !enrolled
  const canStart =
    enrolled &&
    (Boolean(inProgressId) ||
      Boolean(awaitingGradingId) ||
      (eligible && unlocked))
  const isBlocked =
    notEnrolled || (!inProgressId && !awaitingGradingId && !unlocked)

  const handleStart = async () => {
    if (notEnrolled) {
      toast.error(blockReason || 'Matrícula ativa necessária para iniciar a prova.')
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
    if (!unlocked) {
      toast.error(
        blockReason ||
          'A prova oficial está bloqueada. Aguarde a liberação pelo administrador.'
      )
      return
    }

    setLoading(true)
    try {
      const res = await fetch('/api/assessments/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'PROVA' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao iniciar prova')
      router.push(`/student/avaliacao/${data.id || data.assessment_id}`)
    } catch (error: unknown) {
      console.error(error)
      toast.error(
        error instanceof Error
          ? error.message
          : 'Ocorreu um erro ao iniciar a prova. Tente novamente.'
      )
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500">
        Verificando disponibilidade da prova...
      </div>
    )
  }

  const startLabel = loading
    ? 'Aguarde...'
    : inProgressId
      ? 'Continuar Prova'
      : awaitingGradingId
        ? 'Ver resultado (aguardando correção)'
        : notEnrolled
          ? 'Sem matrícula'
          : isBlocked
            ? 'Prova bloqueada'
            : 'Iniciar Prova'

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
                isBlocked ? 'bg-slate-100' : 'bg-sky-100'
              }`}
            >
              {isBlocked ? (
                <Lock className="w-6 h-6 text-slate-500" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-primary" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                <CardTitle className="text-2xl font-bold text-secondary">Prova Oficial</CardTitle>
                {courseName && enrolled && (
                  <span className="text-sm text-slate-500">Curso: {courseName}</span>
                )}
              </div>
              <CardDescription className="text-base mt-1 text-slate-600">
                {notEnrolled
                  ? 'Matrícula ativa necessária para realizar a prova deste curso.'
                  : inProgressId
                    ? 'Você tem uma prova em andamento neste curso.'
                    : isBlocked
                      ? 'Aguardando liberação pelo administrador para o curso selecionado.'
                      : 'Avaliação final do curso selecionado para emissão do certificado.'}
              </CardDescription>
            </div>
            {!isBlocked && unlocked && unlockLabel && !inProgressId && (
              <div className="hidden md:block shrink-0 text-right text-sm text-green-800 bg-green-50 border border-green-200 rounded-xl px-3 py-2 max-w-[14rem]">
                Liberada até {unlockLabel}
                <div className="text-xs text-green-700 mt-0.5">
                  Restam {formatRemaining(remainingMs)}
                </div>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="px-5 sm:px-6 py-5 space-y-4">
          {isBlocked && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-slate-50 px-4 py-3.5 rounded-xl border border-slate-200">
              <p className="flex-1 text-slate-700 font-medium text-sm sm:text-base leading-snug">
                {blockReason ||
                  (notEnrolled
                    ? 'Você não possui matrícula ativa neste curso.'
                    : 'A prova oficial está bloqueada. Aguarde a liberação pelo administrador.')}
              </p>
              {notEnrolled && (
                <Link href="/student/matriculas" className="shrink-0">
                  <Button variant="primary" size="sm">
                    Solicitar matrícula
                  </Button>
                </Link>
              )}
            </div>
          )}

          {!isBlocked && unlocked && unlockLabel && !inProgressId && (
            <div className="md:hidden bg-green-50 px-4 py-2.5 rounded-xl border border-green-200 text-sm text-green-800 text-center">
              Liberada até {unlockLabel} (restam {formatRemaining(remainingMs)}).
            </div>
          )}

          {enrolled && (
            <CompositionSummary
              mcCount={mcCount}
              discursiveCount={discursiveCount}
              mcWeightPercent={mcWeightPercent}
              discursiveWeightPercent={discursiveWeightPercent}
              timeLimitMinutes={timeLimitMinutes}
              accentClassName="text-primary"
              passingScore={passingScore}
              showPassingHint
            />
          )}
        </CardContent>

        {enrolled && (
          <CardFooter className="mt-0 flex flex-col sm:flex-row sm:items-center gap-4 px-5 sm:px-6 py-4 border-t border-slate-100 bg-amber-50/70">
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-amber-950 mb-1.5 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-brand-gold-dark shrink-0" />
                Avisos importantes
              </h3>
              <ul className="grid sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm text-amber-950/90 leading-snug">
                <li>O cronômetro não pausa, mesmo se você fechar a página.</li>
                <li>Respostas salvas automaticamente — dá para retomar dentro do tempo.</li>
                <li>Use um ambiente tranquilo e com boa conexão à internet.</li>
              </ul>
            </div>
            <Button
              size="lg"
              variant="primary"
              className="w-full sm:w-auto shrink-0 px-8 py-3.5 text-base rounded-full"
              onClick={handleStart}
              disabled={loading || !canStart}
            >
              {startLabel}
            </Button>
          </CardFooter>
        )}

        {!enrolled && (
          <CardFooter className="mt-0 flex justify-center px-5 sm:px-6 py-4 border-t border-slate-100">
            <Button
              size="lg"
              variant="primary"
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
