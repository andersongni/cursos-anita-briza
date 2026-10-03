'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Card, { CardContent, CardHeader, CardFooter } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { CheckCircle2, XCircle, Award, ArrowLeft, BookOpen } from 'lucide-react'
import Spinner from '@/components/ui/Spinner'
import { formatDuration } from '@/lib/utils'

export default function ResultadoPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [result, setResult] = useState<any>(null)
  const [passingScore, setPassingScore] = useState(70)

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const res = await fetch(`/api/assessments/${id}`, { cache: 'no-store' })
        if (!res.ok) throw new Error('Falha ao carregar resultado')
        const payload = await res.json()
        const assessment = payload.assessment ?? payload

        if (assessment.status === 'IN_PROGRESS') {
          router.replace(`/student/avaliacao/${id}`)
          return
        }

        if (assessment.status === 'CANCELLED') {
          setResult(assessment)
          return
        }

        setResult(assessment)

        const type = assessment.type === 'PROVA' ? 'PROVA' : 'SIMULADO'
        const elig = await fetch(`/api/assessments/check-eligibility?type=${type}`, {
          cache: 'no-store',
        })
        if (elig.ok) {
          const data = await elig.json()
          const p = Number(data.passingScore)
          if (Number.isFinite(p)) setPassingScore(p)
        }
      } catch (error) {
        console.error(error)
      } finally {
        setLoading(false)
      }
    }
    fetchResult()
  }, [id, router])

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!result) {
    return <div className="p-8 text-center text-slate-500">Erro ao carregar resultado.</div>
  }

  if (result.status === 'CANCELLED') {
    const home =
      result.type === 'PROVA' ? '/student/prova' : '/student/simulado'
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <p className="text-slate-700 text-lg font-medium">Avaliação abortada</p>
        <p className="text-slate-600">
          Esta {result.type === 'PROVA' ? 'prova' : 'simulado'} foi cancelada e não foi corrigida.
        </p>
        <Button onClick={() => router.push(home)}>Voltar</Button>
      </div>
    )
  }

  const totalQuestions = result.total_questions || result.questions?.length || 0
  if (totalQuestions === 0) {
    return (
      <div className="max-w-lg mx-auto py-12 px-4 text-center space-y-4">
        <p className="text-slate-600">
          Esta avaliação está inválida (sem questões). Inicie um novo simulado ou prova.
        </p>
        <Button onClick={() => router.push('/dashboard')}>Voltar ao início</Button>
      </div>
    )
  }

  const isApproved = !!result.passed
  const correctAnswers = result.correct_count ?? 0
  const wrongAnswers = result.wrong_count ?? Math.max(0, totalQuestions - correctAnswers)

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-8">
      <Card
        className={`border-2 shadow-lg ${isApproved ? 'border-green-200' : 'border-red-200'}`}
      >
        <CardHeader
          className={`text-center pb-8 ${isApproved ? 'bg-green-50' : 'bg-red-50'} rounded-t-xl`}
        >
          <Badge className="mx-auto mb-4" variant={result.type === 'PROVA' ? 'error' : 'info'}>
            {result.type === 'PROVA' ? 'Prova Oficial' : 'Simulado'}
          </Badge>

          <div className="flex justify-center mb-6">
            <div
              className={`relative w-40 h-40 rounded-full flex items-center justify-center border-8 ${
                isApproved ? 'border-green-500' : 'border-red-500'
              } bg-white shadow-inner`}
            >
              <div className="text-center">
                <span
                  className={`text-5xl font-bold ${
                    isApproved ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {Math.round(result.score || 0)}%
                </span>
              </div>
            </div>
          </div>

          <h2
            className={`text-3xl font-bold ${isApproved ? 'text-green-800' : 'text-red-800'}`}
          >
            {isApproved ? 'APROVADO' : 'REPROVADO'}
          </h2>
          <p className={`mt-2 text-lg ${isApproved ? 'text-green-700' : 'text-red-700'}`}>
            {isApproved
              ? 'Parabéns! Você alcançou a nota necessária.'
              : `Você não alcançou a nota mínima de ${passingScore}%.`}
          </p>
        </CardHeader>

        <CardContent className="pt-8">
          <div className="grid grid-cols-2 gap-6 max-w-md mx-auto">
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
              <div className="text-sm font-medium text-slate-500 uppercase mb-1">Acertos</div>
              <div className="text-2xl font-bold text-green-600 flex items-center justify-center gap-2">
                <CheckCircle2 className="w-6 h-6" /> {correctAnswers}
              </div>
            </div>
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-center">
              <div className="text-sm font-medium text-slate-500 uppercase mb-1">Erros</div>
              <div className="text-2xl font-bold text-red-600 flex items-center justify-center gap-2">
                <XCircle className="w-6 h-6" /> {wrongAnswers}
              </div>
            </div>
          </div>

          {result.duration_seconds != null && (
            <p className="text-center text-sm text-slate-500 mt-6">
              Duração: {formatDuration(result.duration_seconds)}
            </p>
          )}
        </CardContent>

        <CardFooter className="flex flex-col sm:flex-row gap-3 justify-center pb-8">
          <Button variant="outline" onClick={() => router.push('/dashboard')}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Voltar ao início
          </Button>
          {result.type === 'SIMULADO' && (
            <Button onClick={() => router.push(`/student/revisao/${id}`)}>
              <BookOpen className="w-4 h-4 mr-2" /> Ver respostas e explicações
            </Button>
          )}
          {result.type === 'PROVA' && isApproved && (
            <Button onClick={() => router.push('/student/certificados')}>
              <Award className="w-4 h-4 mr-2" /> Certificado
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  )
}
