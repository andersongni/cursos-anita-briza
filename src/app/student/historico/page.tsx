'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Card, { CardContent } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { formatDate, formatDuration } from '@/lib/utils'
import { Eye, Play } from 'lucide-react'
import toast from 'react-hot-toast'

type HistoryItem = {
  id: string
  type: string
  status: string
  score: number | null
  passed: boolean | null
  createdAt: string
  duration: number | null
  attemptNumber: number
}

export default function HistoricoPage() {
  const router = useRouter()
  const [assessments, setAssessments] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [blocked, setBlocked] = useState(false)

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const coursesRes = await fetch('/api/student/courses', { cache: 'no-store' })
        if (coursesRes.ok) {
          const coursesData = await coursesRes.json()
          const active = coursesData.active ?? coursesData.courses ?? []
          if (!Array.isArray(active) || active.length === 0) {
            setBlocked(true)
            return
          }
        }

        const res = await fetch('/api/student/history')
        if (res.status === 403) {
          setBlocked(true)
          return
        }
        if (!res.ok) throw new Error('Falha ao carregar histórico')
        const data = await res.json()
        setAssessments(data.assessments ?? [])
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar histórico')
      } finally {
        setLoading(false)
      }
    }
    void fetchHistory()
  }, [])

  useEffect(() => {
    if (blocked) {
      router.replace('/student/matriculas')
    }
  }, [blocked, router])

  if (loading || blocked) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 space-y-6">
      <h1 className="text-3xl font-bold text-slate-800">Histórico de Avaliações</h1>
      <p className="text-slate-600">Acompanhe seu desempenho em provas e simulados.</p>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Data</th>
                  <th className="px-6 py-4">Tipo</th>
                  <th className="px-6 py-4">Status / Resultado</th>
                  <th className="px-6 py-4">Nota</th>
                  <th className="px-6 py-4">Duração</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {assessments.map((a) => (
                  <tr key={a.id} className="border-b border-slate-100 hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-700">
                      {formatDate(a.createdAt)}
                    </td>
                    <td className="px-6 py-4">
                      <Badge variant={a.type === 'PROVA' ? 'error' : 'info'}>{a.type}</Badge>
                    </td>
                    <td className="px-6 py-4">
                      {a.status === 'IN_PROGRESS' ? (
                        <Badge variant="warning">EM ANDAMENTO</Badge>
                      ) : a.status === 'CANCELLED' ? (
                        <Badge variant="default">ABORTADA</Badge>
                      ) : (
                        <Badge
                          variant={
                            a.status === 'AWAITING_GRADING'
                              ? 'warning'
                              : a.passed
                                ? 'success'
                                : 'error'
                          }
                        >
                          {a.status === 'AWAITING_GRADING'
                            ? 'AGUARDANDO CORREÇÃO'
                            : a.passed
                              ? 'APROVADO'
                              : 'REPROVADO'}
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      {a.score !== null ? `${Math.round(a.score)}%` : '-'}
                    </td>
                    <td className="px-6 py-4 text-slate-600">
                      {a.duration ? formatDuration(a.duration) : '-'}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {a.status === 'IN_PROGRESS' ? (
                        <Button
                          size="sm"
                          onClick={() => router.push(`/student/avaliacao/${a.id}`)}
                        >
                          <Play className="w-4 h-4 mr-1" /> Continuar
                        </Button>
                      ) : a.status === 'CANCELLED' ? (
                        <span className="text-slate-400 text-xs">—</span>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/student/resultado/${a.id}`)}
                        >
                          <Eye className="w-4 h-4 mr-1" /> Ver
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {assessments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-slate-500">
                      Nenhuma avaliação encontrada.{' '}
                      <Link href="/student/matriculas" className="text-secondary underline">
                        Ver matrículas
                      </Link>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
