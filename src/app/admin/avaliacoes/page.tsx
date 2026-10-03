'use client'

import { useCallback, useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Link from 'next/link'
import { formatDateTime, formatDuration } from '@/lib/utils'
import toast from 'react-hot-toast'

type AssessmentRow = {
  id: string
  type: string
  attempt_number: number
  started_at: string
  score: number | null
  passed: boolean | null
  status: string
  duration_seconds: number | null
  student: { full_name: string }
}

export default function AdminAvaliacoesPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [resultFilter, setResultFilter] = useState('')
  const [avaliacoes, setAvaliacoes] = useState<AssessmentRow[]>([])

  const load = useCallback(async () => {
    try {
      const params = new URLSearchParams()
      if (search.trim()) params.set('q', search.trim())
      if (typeFilter) params.set('type', typeFilter)
      if (resultFilter) params.set('result', resultFilter)
      const res = await fetch(`/api/admin/assessments?${params}`)
      if (!res.ok) throw new Error('Falha ao carregar avaliações')
      const data = await res.json()
      setAvaliacoes(data.assessments ?? [])
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar avaliações')
    } finally {
      setLoading(false)
    }
  }, [search, typeFilter, resultFilter])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      load()
    }, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [load, search])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-secondary">Histórico de Avaliações</h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white p-4 rounded-lg shadow-sm">
        <Input
          placeholder="Buscar por aluno..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
        <Select
          options={[
            { value: '', label: 'Tipo: Todos' },
            { value: 'PROVA', label: 'Prova' },
            { value: 'SIMULADO', label: 'Simulado' },
          ]}
          value={typeFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value)}
        />
        <Select
          options={[
            { value: '', label: 'Resultado: Todos' },
            { value: 'APROVADO', label: 'Aprovado' },
            { value: 'REPROVADO', label: 'Reprovado' },
          ]}
          value={resultFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setResultFilter(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Tentativa</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead>Resultado</TableHead>
                <TableHead>Duração</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {avaliacoes.map((av) => {
                const resultado =
                  av.status !== 'COMPLETED'
                    ? av.status
                    : av.passed
                      ? 'APROVADO'
                      : 'REPROVADO'
                return (
                  <TableRow key={av.id}>
                    <TableCell className="font-medium">{av.student.full_name}</TableCell>
                    <TableCell>
                      <Badge variant={av.type === 'PROVA' ? 'default' : 'info'}>{av.type}</Badge>
                    </TableCell>
                    <TableCell>{av.attempt_number}</TableCell>
                    <TableCell>{formatDateTime(av.started_at)}</TableCell>
                    <TableCell>{av.score != null ? av.score.toFixed(1) : '—'}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          resultado === 'APROVADO'
                            ? 'success'
                            : resultado === 'REPROVADO'
                              ? 'error'
                              : 'warning'
                        }
                      >
                        {resultado}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {av.duration_seconds != null
                        ? formatDuration(av.duration_seconds)
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/avaliacoes/${av.id}`}>
                        <Button size="sm" variant="outline">
                          Detalhes
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
              {avaliacoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                    Nenhuma avaliação registrada.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
