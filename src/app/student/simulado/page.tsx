'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Card, { CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Clock, HelpCircle, FileText } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SimuladoStartPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [inProgressId, setInProgressId] = useState<string | null>(null)
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(120)

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch('/api/assessments/check-eligibility?type=SIMULADO', {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        if (data.inProgressId) setInProgressId(data.inProgressId)
        const q = Number(data.questionCount)
        const t = Number(data.timeLimitMinutes)
        if (Number.isFinite(q) && q > 0) setQuestionCount(q)
        if (Number.isFinite(t) && t > 0) setTimeLimitMinutes(t)
      } catch {
        // ignore
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
        body: JSON.stringify({ type: 'SIMULADO' }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Falha ao criar simulado')
      }

      const id = data.id || data.assessment_id
      if (!id) throw new Error('Resposta inválida do servidor')

      router.push(`/student/avaliacao/${id}`)
    } catch (error: any) {
      console.error(error)
      toast.error(error.message || 'Ocorreu um erro ao iniciar o simulado. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <Card className="border-2 border-slate-200 shadow-md">
        <CardHeader className="text-center pb-8 border-b border-slate-100">
          <div className="mx-auto bg-blue-100 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-blue-600" />
          </div>
          <CardTitle className="text-3xl font-bold text-slate-800">Simulado</CardTitle>
          <CardDescription className="text-lg mt-2 text-slate-600">
            Prepare-se para a prova oficial testando seus conhecimentos.
          </CardDescription>
        </CardHeader>

        <CardContent className="py-8 space-y-6">
          <div className="flex flex-col sm:flex-row gap-6 justify-center">
            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg flex-1 justify-center border border-slate-100">
              <HelpCircle className="w-6 h-6 text-blue-500" />
              <div>
                <div className="font-semibold text-slate-800">
                  {questionCount != null ? `${questionCount} Questões` : '… Questões'}
                </div>
                <div className="text-sm text-slate-500">Múltipla escolha</div>
              </div>
            </div>

            <div className="flex items-center gap-3 bg-slate-50 p-4 rounded-lg flex-1 justify-center border border-slate-100">
              <Clock className="w-6 h-6 text-blue-500" />
              <div>
                <div className="font-semibold text-slate-800">Duração</div>
                <div className="text-sm text-slate-500">
                  {timeLimitMinutes} minutos (cronometrado)
                </div>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-6 rounded-lg border border-blue-100 mt-6 text-center">
            <h3 className="font-semibold text-blue-800 mb-2">Instruções</h3>
            <p className="text-blue-700">
              O simulado é uma ferramenta de estudo. Após finalizar, você poderá revisar suas
              respostas e ver as explicações detalhadas para cada questão. O resultado não afeta sua
              nota final.
            </p>
          </div>

          {inProgressId && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 rounded-lg text-center text-sm">
              Você já tem um simulado em andamento. Clique abaixo para continuar.
            </div>
          )}
        </CardContent>

        <CardFooter className="flex justify-center pt-2 pb-8 border-t border-slate-100">
          <Button
            size="lg"
            className="w-full sm:w-auto px-12 py-6 text-lg rounded-full"
            onClick={handleStart}
            disabled={loading}
          >
            {loading
              ? 'Iniciando...'
              : inProgressId
                ? 'Continuar Simulado'
                : 'Iniciar Simulado'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
