'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/utils'

type RankingRow = {
  rank: number
  attemptId: string
  studentId: string
  fullName: string
  username: string
  durationMs: number
  hits: number
  misses: number
  expired: number
  points: number
  accuracy: number
  score: number
  maxCombo: number
  avgReactionMs: number
  completedAt: string
}

function formatReactionMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

export default function AdminMouseAccuracyRankingPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<RankingRow[]>([])
  const [totalAttempts, setTotalAttempts] = useState(0)

  const load = useCallback(async (q?: string) => {
    try {
      const url = q
        ? `/api/admin/mouse-accuracy-ranking?q=${encodeURIComponent(q)}`
        : '/api/admin/mouse-accuracy-ranking'
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar ranking')
      setRows(data.rows ?? [])
      setTotalAttempts(data.totalAttempts ?? 0)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar ranking')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      void load(search.trim() || undefined)
    }, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search, load])

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/exercicios/precisao-do-mouse"
          className="inline-flex items-center text-sm text-accent hover:text-secondary mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar à precisão do mouse
        </Link>
        <h1 className="text-3xl font-bold text-secondary">Ranking — Precisão do mouse</h1>
        <p className="text-gray-500 mt-1">
          Ranking completo de todas as partidas · {totalAttempts} tentativa
          {totalAttempts === 1 ? '' : 's'} no total
          {search.trim() ? ` · ${rows.length} no filtro` : ''}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        <Input
          placeholder="Buscar por aluno ou usuário..."
          className="max-w-md"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <Spinner size="lg" />
          </div>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-gray-500">Nenhuma partida registrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Data e hora</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Pontos</TableHead>
                <TableHead>Acertos</TableHead>
                <TableHead>Erros</TableHead>
                <TableHead>Sumiram</TableHead>
                <TableHead>Precisão</TableHead>
                <TableHead>Reação</TableHead>
                <TableHead>Sequência</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.attemptId}>
                  <TableCell className="tabular-nums">{row.rank}º</TableCell>
                  <TableCell>{row.fullName}</TableCell>
                  <TableCell>{row.username}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDateTime(row.completedAt)}
                  </TableCell>
                  <TableCell className="tabular-nums font-semibold">{row.score}</TableCell>
                  <TableCell className="tabular-nums">{row.points}</TableCell>
                  <TableCell className="tabular-nums">{row.hits}</TableCell>
                  <TableCell className="tabular-nums">{row.misses}</TableCell>
                  <TableCell className="tabular-nums">{row.expired}</TableCell>
                  <TableCell className="tabular-nums">{row.accuracy.toFixed(1)}%</TableCell>
                  <TableCell className="tabular-nums">
                    {formatReactionMs(row.avgReactionMs)}
                  </TableCell>
                  <TableCell className="tabular-nums">{row.maxCombo}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
