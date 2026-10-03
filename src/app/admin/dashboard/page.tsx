'use client'

import { useState, useEffect } from 'react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import { Users, ClipboardList, BarChart3, HelpCircle, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'

type DashboardStats = {
  alunos: { total: number; pendentes: number; aprovados: number; bloqueados: number }
  avaliacoes: { realizadas: number; aprovados: number; reprovados: number; simulados: number }
  desempenho: { media: number; taxaAprovacao: number }
  perguntas: { totalProva: number; totalSimulado: number; ativas: number; inativas: number }
  alertas: string[]
}

const emptyStats: DashboardStats = {
  alunos: { total: 0, pendentes: 0, aprovados: 0, bloqueados: 0 },
  avaliacoes: { realizadas: 0, aprovados: 0, reprovados: 0, simulados: 0 },
  desempenho: { media: 0, taxaAprovacao: 0 },
  perguntas: { totalProva: 0, totalSimulado: 0, ativas: 0, inativas: 0 },
  alertas: [],
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats>(emptyStats)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch('/api/admin/dashboard')
        if (!res.ok) throw new Error('Falha ao carregar dashboard')
        setStats(await res.json())
      } catch {
        toast.error('Erro ao carregar os dados do dashboard.')
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-secondary">Dashboard Admin</h1>

      {stats.alertas.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-md">
          <div className="flex items-center mb-2">
            <AlertTriangle className="text-yellow-400 mr-2" />
            <h3 className="font-semibold text-yellow-800">Atenção Necessária</h3>
          </div>
          <ul className="list-disc pl-5 text-sm text-yellow-700">
            {stats.alertas.map((alerta, i) => (
              <li key={i}>{alerta}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-secondary">
              <Users className="mr-2" size={20} />
              Alunos
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 space-y-2">
            <div className="text-3xl font-bold">{stats.alunos.total}</div>
            <div className="flex gap-2 flex-wrap">
              <Badge variant="warning">{stats.alunos.pendentes} Pendentes</Badge>
              <Badge variant="success">{stats.alunos.aprovados} Aprovados</Badge>
              <Badge variant="error">{stats.alunos.bloqueados} Bloqueados</Badge>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-secondary">
              <ClipboardList className="mr-2" size={20} />
              Avaliações
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 space-y-2">
            <div className="text-3xl font-bold">
              {stats.avaliacoes.realizadas}{' '}
              <span className="text-sm font-normal text-gray-500">Provas</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-green-600">{stats.avaliacoes.aprovados} Aprovados</span>
              <span className="text-red-600">{stats.avaliacoes.reprovados} Reprovados</span>
            </div>
            <div className="text-sm text-gray-500">
              {stats.avaliacoes.simulados} Simulados realizados
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-secondary">
              <BarChart3 className="mr-2" size={20} />
              Desempenho
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 space-y-2">
            <div className="text-3xl font-bold text-primary">{stats.desempenho.taxaAprovacao}%</div>
            <div className="text-sm text-gray-500">Taxa de Aprovação</div>
            <div className="mt-2 text-lg font-semibold">
              {stats.desempenho.media}{' '}
              <span className="text-sm font-normal text-gray-500">Média Geral</span>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center text-secondary">
              <HelpCircle className="mr-2" size={20} />
              Perguntas
            </CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 space-y-2">
            <div className="text-3xl font-bold">
              {stats.perguntas.ativas + stats.perguntas.inativas}
            </div>
            <div className="flex gap-2 text-sm">
              <span className="font-semibold text-secondary">
                {stats.perguntas.totalProva} PROVA
              </span>
              <span className="font-semibold text-accent">
                {stats.perguntas.totalSimulado} SIMULADO
              </span>
            </div>
            <div className="flex gap-2">
              <Badge variant="success">{stats.perguntas.ativas} Ativas</Badge>
              <Badge variant="default">{stats.perguntas.inativas} Inativas</Badge>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
