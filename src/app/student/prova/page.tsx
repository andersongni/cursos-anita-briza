'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Clock, HelpCircle, AlertTriangle, CheckCircle2, Lock } from 'lucide-react'
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
  const [questionCount, setQuestionCount] = useState(40)
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
      const q = Number(data.questionCount)
      const t = Number(data.timeLimitMinutes)
      const p = Number(data.passingScore)
      if (Number.isFinite(q) && q > 0) setQuestionCount(q)
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
      <div className="p-8 text-center text-slate-500">Verificando disponibilidade da prova...</div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="text-center pb-8 border-b border-slate-100">
          <div
            className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
              isBlocked ? 'bg-slate-100' : 'bg-sky-100'
            }`}
          >
            {isBlocked ? (
              <Lock className="w-8 h-8 text-slate-500" />
            ) : (
              <CheckCircle2 className="w-8 h-8 text-primary" />
            )}
          </div>
          <CardTitle className="text-3xl font-bold text-secondary">Prova Oficial</CardTitle>
          <CardDescription className="text-lg mt-2 text-slate-600">
            {notEnrolled
              ? 'Matrícula ativa necessária para realizar a prova deste curso.'
              : inProgressId
                ? 'Você tem uma prova em andamento neste curso.'
                : isBlocked
                  ? 'Aguardando liberação pelo administrador para o curso selecionado.'
                  : 'Avaliação final do curso selecionado para emissão do certificado.'}
          </CardDescription>
          {courseName && enrolled && (
            <p className="text-sm text-slate-500 mt-2">Curso: {courseName}</p>
          )}
        </CardHeader>

        <CardContent className="py-8 space-y-6">
          {isBlocked && (
            <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 text-center space-y-3">
              <p className="text-slate-700 font-medium">
                {blockReason ||
                  (notEnrolled
                    ? 'Você não possui matrícula ativa neste curso.'
                    : 'A prova oficial está bloqueada. Aguarde a liberação pelo administrador.')}
              </p>
              {notEnrolled && (
                <Link href="/student/matriculas">
                  <Button variant="primary" size="sm">
                    Solicitar matrícula
                  </Button>
                </Link>
              )}
            </div>
          )}

          {!isBlocked && unlocked && unlockLabel && !inProgressId && (
            <div className="bg-green-50 p-4 rounded-lg border border-green-200 text-center text-sm text-green-800">
              Liberada até {unlockLabel} (restam {formatRemaining(remainingMs)}).
            </div>
          )}

          {enrolled && (
            <>
              <div className="flex flex-col sm:flex-row gap-6 justify-center">
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg flex-1 justify-center border border-slate-100">
                  <HelpCircle className="w-6 h-6 text-primary" />
                  <div>
                    <div className="font-semibold text-slate-800">{questionCount} Questões</div>
                    <div className="text-sm text-slate-500">
                      Para aprovação: {Math.ceil((questionCount * passingScore) / 100)} acertos (
                      {passingScore}%)
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg flex-1 justify-center border border-slate-100">
                  <Clock className="w-6 h-6 text-primary" />
                  <div>
                    <div className="font-semibold text-slate-800">Duração</div>
                    <div className="text-sm text-slate-500">
                      {timeLimitMinutes} minutos (cronometrado)
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 p-6 rounded-lg border border-brand-gold/40 mt-6">
                <h3 className="font-semibold text-amber-950 mb-4 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-brand-gold-dark" />
                  Avisos Importantes
                </h3>
                <ul className="space-y-3 text-amber-950/90">
                  <li className="flex items-start gap-2">
                    <span className="font-bold mt-0.5">•</span>
                    <span>
                      Após iniciar, o cronômetro não poderá ser pausado, mesmo que você feche a
                      página.
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold mt-0.5">•</span>
                    <span>
                      As respostas são salvas automaticamente. Se a conexão cair, você poderá
                      retornar de onde parou (desde que dentro do tempo).
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="font-bold mt-0.5">•</span>
                    <span>
                      Certifique-se de estar em um ambiente tranquilo e com boa conexão à internet.
                    </span>
                  </li>
                </ul>
              </div>
            </>
          )}
        </CardContent>

        <CardFooter className="flex justify-center pt-2 pb-8 border-t border-slate-100">
          <Button
            size="lg"
            variant="primary"
            className="w-full sm:w-auto px-12 py-6 text-lg rounded-full"
            onClick={handleStart}
            disabled={loading || !canStart}
          >
            {loading
              ? 'Aguarde...'
              : inProgressId
                ? 'Continuar Prova'
                : awaitingGradingId
                  ? 'Ver resultado (aguardando correção)'
                  : notEnrolled
                    ? 'Sem matrícula'
                    : isBlocked
                      ? 'Prova bloqueada'
                      : 'Iniciar Prova'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
