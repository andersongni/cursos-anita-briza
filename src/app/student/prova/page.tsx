'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Clock, HelpCircle, AlertTriangle, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ProvaStartPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [inProgressId, setInProgressId] = useState<string | null>(null)
  const [questionCount, setQuestionCount] = useState(40)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(120)
  const [passingScore, setPassingScore] = useState(70)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/assessments/check-eligibility?type=PROVA', {
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          if (data.inProgressId) setInProgressId(data.inProgressId)
          const q = Number(data.questionCount)
          const t = Number(data.timeLimitMinutes)
          const p = Number(data.passingScore)
          if (Number.isFinite(q) && q > 0) setQuestionCount(q)
          if (Number.isFinite(t) && t > 0) setTimeLimitMinutes(t)
          if (Number.isFinite(p) && p >= 0) setPassingScore(p)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setChecking(false)
      }
    }
    check()
  }, [])

  const handleStart = async () => {
    if (inProgressId) {
      router.push(`/student/avaliacao/${inProgressId}`)
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

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao iniciar prova')
      }

      router.push(`/student/avaliacao/${data.id || data.assessment_id}`)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Ocorreu um erro ao iniciar a prova. Tente novamente.')
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
          <div className="mx-auto bg-red-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-8 h-8 text-red-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-800">Prova Oficial</CardTitle>
          <CardDescription className="text-lg mt-2 text-slate-600">
            {inProgressId
              ? 'Você tem uma prova em andamento.'
              : 'Avaliação final para emissão do certificado.'}
          </CardDescription>
        </CardHeader>

        <CardContent className="py-8 space-y-6">
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg flex-1 justify-center border border-slate-100">
              <HelpCircle className="w-6 h-6 text-red-500" />
              <div>
                <div className="font-semibold text-slate-800">{questionCount} Questões</div>
                <div className="text-sm text-slate-500">
                  Para aprovação: {Math.ceil((questionCount * passingScore) / 100)} acertos (
                  {passingScore}%)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg flex-1 justify-center border border-slate-100">
              <Clock className="w-6 h-6 text-red-500" />
              <div>
                <div className="font-semibold text-slate-800">Duração</div>
                <div className="text-sm text-slate-500">
                  {timeLimitMinutes} minutos (cronometrado)
                </div>
              </div>
            </div>
          </div>

          <div className="bg-red-50 p-6 rounded-lg border border-red-100 mt-6">
            <h3 className="font-semibold text-red-800 mb-4 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Avisos Importantes
            </h3>
            <ul className="space-y-3 text-red-700">
              <li className="flex items-start gap-2">
                <span className="font-bold mt-0.5">•</span>
                <span>
                  Após iniciar, o cronômetro não poderá ser pausado, mesmo que você feche a página.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold mt-0.5">•</span>
                <span>
                  As respostas são salvas automaticamente. Se a conexão cair, você poderá retornar
                  de onde parou (desde que dentro do tempo).
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
        </CardContent>

        <CardFooter className="flex justify-center pt-2 pb-8 border-t border-slate-100">
          <Button
            size="lg"
            className="w-full sm:w-auto px-12 py-6 text-lg rounded-full bg-red-600 hover:bg-red-700 text-white"
            onClick={handleStart}
            disabled={loading}
          >
            {loading ? 'Aguarde...' : inProgressId ? 'Continuar Prova' : 'Iniciar Prova'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
