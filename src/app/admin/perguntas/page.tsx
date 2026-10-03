'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type Question = {
  id: string
  type: string
  question_text: string
  active: boolean
  created_at: string
  dimension: { id: string; name: string } | null
}

type Dimension = { id: string; name: string }

export default function AdminPerguntasPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [themeFilter, setThemeFilter] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState('Todas')
  const [loading, setLoading] = useState(true)
  const [perguntas, setPerguntas] = useState<Question[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])

  const load = useCallback(async () => {
    try {
      const [qRes, dRes] = await Promise.all([
        fetch('/api/admin/questions'),
        fetch('/api/admin/dimensions'),
      ])
      if (!qRes.ok) throw new Error('Falha ao carregar perguntas')
      const qData = await qRes.json()
      const dData = dRes.ok ? await dRes.json() : { dimensions: [] }
      setPerguntas(qData.questions ?? [])
      setDimensions(dData.dimensions ?? [])
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar perguntas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filtered = useMemo(() => {
    return perguntas.filter((p) => {
      const matchesSearch = p.question_text.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === 'Todos' || p.type === typeFilter
      const matchesTheme =
        themeFilter === 'Todos' || p.dimension?.id === themeFilter || p.dimension?.name === themeFilter
      const matchesStatus =
        statusFilter === 'Todas' ||
        (statusFilter === 'Ativas' && p.active) ||
        (statusFilter === 'Inativas' && !p.active)
      return matchesSearch && matchesType && matchesTheme && matchesStatus
    })
  }, [perguntas, searchTerm, typeFilter, themeFilter, statusFilter])

  const handleToggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/questions/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !currentStatus }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar')
      toast.success(`Pergunta ${currentStatus ? 'desativada' : 'ativada'} com sucesso.`)
      await load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-secondary">Banco de Perguntas</h1>
        <Link href="/admin/perguntas/nova">
          <Button variant="primary">Nova Pergunta</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-lg shadow-sm">
        <Input
          placeholder="Buscar no texto da pergunta..."
          value={searchTerm}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
        />
        <Select
          options={[
            { value: 'Todos', label: 'Todos os Tipos' },
            { value: 'PROVA', label: 'Prova' },
            { value: 'SIMULADO', label: 'Simulado' },
          ]}
          value={typeFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value)}
        />
        <Select
          options={[
            { value: 'Todos', label: 'Todos os Temas' },
            ...dimensions.map((d) => ({ value: d.id, label: d.name })),
          ]}
          value={themeFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setThemeFilter(e.target.value)}
        />
        <Select
          options={[
            { value: 'Todas', label: 'Qualquer Status' },
            { value: 'Ativas', label: 'Ativas' },
            { value: 'Inativas', label: 'Inativas' },
          ]}
          value={statusFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <Spinner size="lg" />
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Tema</TableHead>
                  <TableHead>Pergunta</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Criada em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>
                      <Badge variant={p.type === 'PROVA' ? 'default' : 'info'}>{p.type}</Badge>
                    </TableCell>
                    <TableCell>{p.dimension?.name ?? '—'}</TableCell>
                    <TableCell className="max-w-xs truncate">{p.question_text}</TableCell>
                    <TableCell>
                      <Badge variant={p.active ? 'success' : 'default'}>
                        {p.active ? 'Ativa' : 'Inativa'}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(p.created_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleToggleActive(p.id, p.active)}
                      >
                        {p.active ? 'Desativar' : 'Ativar'}
                      </Button>
                      <Link href={`/admin/perguntas/${p.id}`}>
                        <Button size="sm" variant="outline">
                          Editar
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                      Nenhuma pergunta cadastrada.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <div className="p-4 border-t text-sm text-gray-500">
              Mostrando {filtered.length} de {perguntas.length} perguntas
            </div>
          </>
        )}
      </div>
    </div>
  )
}
