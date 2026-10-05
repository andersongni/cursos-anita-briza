'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import Card, { CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import {
  Users,
  ClipboardList,
  BarChart3,
  HelpCircle,
  AlertTriangle,
  Lock,
  Unlock,
} from 'lucide-react'
import {
  PROVA_UNLOCK_UNTIL_KEY,
  PROVA_UNLOCK_WINDOW_HOURS,
} from '@/lib/settings/assessment-constants'
import toast from 'react-hot-toast'

type ThemeStat = {
  total: number
  correct: number
  wrong: number
  pct: number | null
}

type ThemePerformance = {
  dimensionId: string | null
  name: string
  active: boolean
  prova: ThemeStat
  simulado: ThemeStat
}

type ThemeDetailTypeFilter = 'ALL' | 'PROVA' | 'SIMULADO'
type ThemeDetailResultFilter = 'ALL' | 'CORRECT' | 'WRONG' | 'BLANK'

type ThemeAnswerRow = {
  id: string
  studentId: string
  studentName: string
  studentUsername: string
  assessmentId: string
  assessmentType: 'PROVA' | 'SIMULADO'
  questionText: string
  selectedOption: string | null
  selectedText: string
  correctOption: string | null
  correctText: string
  isBlank: boolean
  isCorrect: boolean
  answeredAt: string | null
}

type ThemeDetailsResponse = {
  theme: { dimensionId: string | null; name: string }
  summary: { total: number; correct: number; wrong: number; blank: number }
  answers: ThemeAnswerRow[]
  truncated?: boolean
}

type DashboardStats = {
  alunos: { total: number; pendentes: number; aprovados: number; bloqueados: number }
  avaliacoes: { realizadas: number; aprovados: number; reprovados: number; simulados: number }
  desempenho: { media: number; taxaAprovacao: number }
  desempenhoPorTema: ThemePerformance[]
  perguntas: { totalProva: number; totalSimulado: number; ativas: number; inativas: number }
  prova?: { unlocked: boolean; unlockUntil: string | null; remainingMs: number }
  alertas: string[]
}

const emptyStats: DashboardStats = {
  alunos: { total: 0, pendentes: 0, aprovados: 0, bloqueados: 0 },
  avaliacoes: { realizadas: 0, aprovados: 0, reprovados: 0, simulados: 0 },
  desempenho: { media: 0, taxaAprovacao: 0 },
  desempenhoPorTema: [],
  perguntas: { totalProva: 0, totalSimulado: 0, ativas: 0, inativas: 0 },
  prova: { unlocked: false, unlockUntil: null, remainingMs: 0 },
  alertas: [],
}

function formatUnlockUntil(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function pctClass(pct: number | null) {
  if (pct == null) return 'text-slate-400'
  if (pct >= 70) return 'text-green-700'
  if (pct >= 50) return 'text-amber-700'
  return 'text-red-700'
}

function ThemeMetric({ stat }: { stat: ThemeStat }) {
  if (stat.total === 0) {
    return <span className="text-slate-400">—</span>
  }
  return (
    <div className="space-y-1.5 min-w-[140px]">
      <div className={`text-lg font-semibold tabular-nums ${pctClass(stat.pct)}`}>
        {stat.pct}%
      </div>
      <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full ${
            (stat.pct ?? 0) >= 70
              ? 'bg-green-500'
              : (stat.pct ?? 0) >= 50
                ? 'bg-amber-500'
                : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, stat.pct ?? 0))}%` }}
        />
      </div>
      <div className="text-xs text-slate-500">
        {stat.correct}/{stat.total} acertos
      </div>
    </div>
  )
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true)
  const [unlocking, setUnlocking] = useState(false)
  const [stats, setStats] = useState<DashboardStats>(emptyStats)
  const [nowTick, setNowTick] = useState(() => Date.now())

  const [themeDetail, setThemeDetail] = useState<ThemePerformance | null>(null)
  const [themeTypeFilter, setThemeTypeFilter] = useState<ThemeDetailTypeFilter>('ALL')
  const [themeResultFilter, setThemeResultFilter] = useState<ThemeDetailResultFilter>('ALL')
  const [themeDetailsLoading, setThemeDetailsLoading] = useState(false)
  const [themeDetails, setThemeDetails] = useState<ThemeDetailsResponse | null>(null)

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/dashboard', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar dashboard')
      setStats(await res.json())
      setNowTick(Date.now())
    } catch {
      toast.error('Erro ao carregar os dados do dashboard.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchStats()
  }, [fetchStats])

  const fetchThemeDetails = useCallback(
    async (
      tema: ThemePerformance,
      type: ThemeDetailTypeFilter,
      result: ThemeDetailResultFilter
    ) => {
      setThemeDetailsLoading(true)
      try {
        const params = new URLSearchParams()
        if (tema.dimensionId) params.set('dimensionId', tema.dimensionId)
        params.set('name', tema.name)
        params.set('type', type)
        params.set('result', result)

        const res = await fetch(`/api/admin/dashboard/theme-details?${params}`, {
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Falha ao carregar detalhes')
        setThemeDetails(data as ThemeDetailsResponse)
      } catch (e: unknown) {
        toast.error(e instanceof Error ? e.message : 'Erro ao carregar detalhes do tema')
        setThemeDetails(null)
      } finally {
        setThemeDetailsLoading(false)
      }
    },
    []
  )

  const openThemeDetails = (tema: ThemePerformance) => {
    setThemeDetails(null)
    setThemeTypeFilter('ALL')
    setThemeResultFilter('ALL')
    setThemeDetail(tema)
  }

  const closeThemeDetails = () => {
    setThemeDetail(null)
    setThemeDetails(null)
  }

  useEffect(() => {
    if (!themeDetail) return
    void fetchThemeDetails(themeDetail, themeTypeFilter, themeResultFilter)
  }, [themeDetail, themeTypeFilter, themeResultFilter, fetchThemeDetails])

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  const unlockUntil = stats.prova?.unlockUntil ?? null
  const unlocked =
    Boolean(unlockUntil) &&
    new Date(unlockUntil as string).getTime() > nowTick

  const setProvaUnlockUntil = async (untilIso: string | null) => {
    setUnlocking(true)
    try {
      const value = untilIso ?? ''
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: PROVA_UNLOCK_UNTIL_KEY, value }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao atualizar liberação da prova')
      }
      setStats((prev) => ({
        ...prev,
        prova: {
          unlocked: Boolean(untilIso),
          unlockUntil: untilIso,
          remainingMs: untilIso
            ? Math.max(0, new Date(untilIso).getTime() - Date.now())
            : 0,
        },
      }))
      setNowTick(Date.now())
      toast.success(
        untilIso
          ? `Prova liberada por ${PROVA_UNLOCK_WINDOW_HOURS} horas.`
          : 'Prova bloqueada novamente.'
      )
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar liberação da prova')
    } finally {
      setUnlocking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-full">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-secondary">Painel administrativo</h1>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-secondary">
            {unlocked ? <Unlock size={20} /> : <Lock size={20} />}
            Liberação da Prova Oficial
          </CardTitle>
          <CardDescription>
            Por padrão a prova fica bloqueada. Ao liberar, os alunos podem iniciá-la nas próximas{' '}
            {PROVA_UNLOCK_WINDOW_HOURS} horas. Quem já tiver prova em andamento pode continuar mesmo
            depois.
          </CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-4">
          <p className={`text-sm font-medium ${unlocked ? 'text-green-700' : 'text-red-700'}`}>
            {unlocked && unlockUntil
              ? `Liberada até ${formatUnlockUntil(unlockUntil)}.`
              : 'Bloqueada — alunos não podem iniciar a prova.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="primary"
              loading={unlocking}
              onClick={() => {
                const until = new Date(
                  Date.now() + PROVA_UNLOCK_WINDOW_HOURS * 60 * 60 * 1000
                )
                void setProvaUnlockUntil(until.toISOString())
              }}
            >
              Liberar prova por {PROVA_UNLOCK_WINDOW_HOURS}h
            </Button>
            <Button
              variant="outline"
              loading={unlocking}
              disabled={!unlocked}
              onClick={() => void setProvaUnlockUntil(null)}
            >
              Bloquear agora
            </Button>
          </div>
        </div>
      </Card>

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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-secondary">
            <BarChart3 className="mr-2" size={20} />
            Desempenho por tema
          </CardTitle>
          <CardDescription>
            Percentual de acertos nas avaliações concluídas, separado por prova oficial e simulado.
            Clique em Detalhes para ver as respostas por aluno.
          </CardDescription>
        </CardHeader>
        <div className="p-4 pt-0">
          {stats.desempenhoPorTema.length === 0 ? (
            <p className="text-sm text-slate-500">
              Ainda não há temas cadastrados nem respostas concluídas para calcular o desempenho.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tema</TableHead>
                  <TableHead>Prova</TableHead>
                  <TableHead>Simulado</TableHead>
                  <TableHead className="text-right w-[1%]"> </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.desempenhoPorTema.map((tema) => {
                  const hasAnswers = tema.prova.total > 0 || tema.simulado.total > 0
                  return (
                    <TableRow key={tema.dimensionId ?? tema.name}>
                      <TableCell>
                        <div className="font-medium text-slate-800">{tema.name}</div>
                        {!tema.active && (
                          <div className="text-xs text-slate-400 mt-0.5">
                            Tema inativo / histórico
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <ThemeMetric stat={tema.prova} />
                      </TableCell>
                      <TableCell>
                        <ThemeMetric stat={tema.simulado} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!hasAnswers}
                          onClick={() => openThemeDetails(tema)}
                          title={
                            hasAnswers
                              ? 'Ver respostas deste tema'
                              : 'Ainda não há respostas neste tema'
                          }
                        >
                          Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </Card>

      <Modal
        isOpen={Boolean(themeDetail)}
        onClose={closeThemeDetails}
        title={themeDetail ? `Respostas — ${themeDetail.name}` : 'Respostas do tema'}
        size="full"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Tipo</label>
              <select
                className="border border-border rounded-lg px-3 py-2 text-sm bg-white"
                value={themeTypeFilter}
                onChange={(e) =>
                  setThemeTypeFilter(e.target.value as ThemeDetailTypeFilter)
                }
              >
                <option value="ALL">Prova e simulado</option>
                <option value="PROVA">Somente prova</option>
                <option value="SIMULADO">Somente simulado</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-500 mb-1">Resultado</label>
              <select
                className="border border-border rounded-lg px-3 py-2 text-sm bg-white"
                value={themeResultFilter}
                onChange={(e) =>
                  setThemeResultFilter(e.target.value as ThemeDetailResultFilter)
                }
              >
                <option value="ALL">Todos</option>
                <option value="CORRECT">Certas</option>
                <option value="WRONG">Erradas</option>
                <option value="BLANK">Em branco</option>
              </select>
            </div>
            {themeDetails && (
              <div className="text-xs text-slate-500 pb-2 ml-auto">
                {themeDetails.summary.total} resposta(s)
                {themeResultFilter === 'ALL' && (
                  <>
                    {' '}
                    · {themeDetails.summary.correct} certa(s) · {themeDetails.summary.wrong}{' '}
                    errada(s)
                    {(themeDetails.summary.blank ?? 0) > 0 && (
                      <> · {themeDetails.summary.blank} em branco</>
                    )}
                  </>
                )}
                {themeDetails.truncated && ' · mostrando as 500 mais recentes'}
              </div>
            )}
          </div>

          {themeDetailsLoading ? (
            <div className="flex justify-center py-10">
              <Spinner />
            </div>
          ) : !themeDetails || themeDetails.answers.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              Nenhuma resposta encontrada com os filtros atuais.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Aluno</TableHead>
                    <TableHead>Data/hora</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Pergunta</TableHead>
                    <TableHead>Resposta</TableHead>
                    <TableHead>Gabarito</TableHead>
                    <TableHead>Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {themeDetails.answers.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="align-top">
                        <Link
                          href={`/admin/alunos/${row.studentId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {row.studentName}
                        </Link>
                        <div className="text-xs text-slate-400">@{row.studentUsername}</div>
                      </TableCell>
                      <TableCell className="align-top whitespace-nowrap text-sm text-slate-600">
                        {row.answeredAt
                          ? new Date(row.answeredAt).toLocaleString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '—'}
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={row.assessmentType === 'PROVA' ? 'success' : 'default'}>
                          {row.assessmentType === 'PROVA' ? 'Prova' : 'Simulado'}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top min-w-[220px] max-w-[360px]">
                        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                          {row.questionText}
                        </div>
                      </TableCell>
                      <TableCell className="align-top min-w-[160px] max-w-[280px]">
                        <div className="text-xs font-mono text-slate-500 mb-0.5">
                          {row.selectedOption ?? '—'}
                        </div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                          {row.selectedText}
                        </div>
                      </TableCell>
                      <TableCell className="align-top min-w-[160px] max-w-[280px]">
                        <div className="text-xs font-mono text-slate-500 mb-0.5">
                          {row.correctOption ?? '—'}
                        </div>
                        <div className="text-sm text-slate-700 whitespace-pre-wrap break-words">
                          {row.correctText}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        {row.isBlank ? (
                          <span className="text-sm text-slate-400">—</span>
                        ) : (
                          <Badge variant={row.isCorrect ? 'success' : 'error'}>
                            {row.isCorrect ? 'Certa' : 'Errada'}
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
