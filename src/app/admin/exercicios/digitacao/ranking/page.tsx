'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/utils'
import { formatDurationMs } from '@/lib/exercises/typing'

type RankingRow = {
  rank: number
  attemptId: string
  studentId: string
  fullName: string
  username: string
  passageTitle: string
  durationMs: number
  errorCount: number
  wpm: number
  score: number
  accuracy: number
  completedAt: string
}

export default function AdminTypingRankingPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState<RankingRow[]>([])
  const [totalAttempts, setTotalAttempts] = useState(0)

  const load = useCallback(async (q?: string) => {
    try {
      const url = q
        ? `/api/admin/typing-ranking?q=${encodeURIComponent(q)}`
        : '/api/admin/typing-ranking'
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
          href="/admin/exercicios/digitacao"
          className="inline-flex items-center text-sm text-accent hover:text-secondary mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar à prática de digitação
        </Link>
        <h1 className="text-3xl font-bold text-secondary">Ranking — Digitação</h1>
        <p className="text-gray-500 mt-1">
          Ranking completo de todas as práticas · {totalAttempts} tentativa
          {totalAttempts === 1 ? '' : 's'} no total
          {search.trim() ? ` · ${rows.length} no filtro` : ''}
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        <Input
          placeholder="Buscar por aluno, usuário ou texto..."
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
          <p className="p-8 text-center text-gray-500">Nenhuma tentativa registrada ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Aluno</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Texto</TableHead>
                <TableHead>Data e hora</TableHead>
                <TableHead>Tempo</TableHead>
                <TableHead>Erros</TableHead>
                <TableHead>PPM</TableHead>
                <TableHead>Precisão</TableHead>
                <TableHead>Nota</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.attemptId}>
                  <TableCell className="tabular-nums font-medium">{row.rank}º</TableCell>
                  <TableCell className="font-medium text-secondary">{row.fullName}</TableCell>
                  <TableCell className="text-slate-500 font-mono text-xs">{row.username}</TableCell>
                  <TableCell className="max-w-[12rem]">
                    <span className="block truncate" title={row.passageTitle}>
                      {row.passageTitle}
                    </span>
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-slate-600">
                    {formatDateTime(row.completedAt)}
                  </TableCell>
                  <TableCell className="tabular-nums">{formatDurationMs(row.durationMs)}</TableCell>
                  <TableCell className="tabular-nums">{row.errorCount}</TableCell>
                  <TableCell className="tabular-nums">{row.wpm.toFixed(1)}</TableCell>
                  <TableCell className="tabular-nums">{row.accuracy.toFixed(1)}%</TableCell>
                  <TableCell className="tabular-nums font-semibold text-secondary">
                    {row.score}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
