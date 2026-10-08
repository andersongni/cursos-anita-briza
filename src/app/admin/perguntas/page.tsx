'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import Link from 'next/link'
import { Download, Upload } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useAdminCourse } from '@/components/courses/AdminCourseProvider'
import type { QuestionTransferFile } from '@/lib/assessment/question-transfer'

type Question = {
  id: string
  type: string
  format?: string
  question_text: string
  active: boolean
  created_at: string
  dimension: { id: string; name: string } | null
}

type Dimension = { id: string; name: string }

type ImportResult = {
  total: number
  imported: number
  skipped: number
  errors: number
  sourceCourseSlug?: string
  courseName?: string
  skippedQuestions: { index: number; question_text: string; reason: string }[]
  errorQuestions: { index: number; question_text: string; reason: string }[]
}

export default function AdminPerguntasPage() {
  const { activeCourseId, activeCourse, loading: courseLoading } = useAdminCourse()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [typeFilter, setTypeFilter] = useState('Todos')
  const [formatFilter, setFormatFilter] = useState('Todos')
  const [themeFilter, setThemeFilter] = useState('Todos')
  const [statusFilter, setStatusFilter] = useState('Ativas')
  const [loading, setLoading] = useState(true)
  const [perguntas, setPerguntas] = useState<Question[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const load = useCallback(async () => {
    if (!activeCourseId) return
    setLoading(true)
    try {
      const qs = new URLSearchParams({ courseId: activeCourseId })
      const [qRes, dRes] = await Promise.all([
        fetch(`/api/admin/questions?${qs}`, { cache: 'no-store' }),
        fetch(`/api/admin/dimensions?${qs}`, { cache: 'no-store' }),
      ])
      if (!qRes.ok) throw new Error('Falha ao carregar perguntas')
      const qData = await qRes.json()
      const dData = dRes.ok ? await dRes.json() : { dimensions: [] }
      setPerguntas(qData.questions ?? [])
      setDimensions(dData.dimensions ?? [])
      setSelectedIds(new Set())
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar perguntas')
    } finally {
      setLoading(false)
    }
  }, [activeCourseId])

  useEffect(() => {
    if (courseLoading || !activeCourseId) return
    void load()
  }, [courseLoading, activeCourseId, load])

  const filtered = useMemo(() => {
    return perguntas.filter((p) => {
      const matchesSearch = p.question_text.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesType = typeFilter === 'Todos' || p.type === typeFilter
      const format = p.format === 'DISCURSIVE' ? 'DISCURSIVE' : 'MULTIPLE_CHOICE'
      const matchesFormat = formatFilter === 'Todos' || format === formatFilter
      const matchesTheme =
        themeFilter === 'Todos' || p.dimension?.id === themeFilter || p.dimension?.name === themeFilter
      const matchesStatus =
        statusFilter === 'Todas' ||
        (statusFilter === 'Ativas' && p.active) ||
        (statusFilter === 'Inativas' && !p.active)
      return matchesSearch && matchesType && matchesFormat && matchesTheme && matchesStatus
    })
  }, [perguntas, searchTerm, typeFilter, formatFilter, themeFilter, statusFilter])

  const allFilteredSelected =
    filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id))
  const someFilteredSelected = filtered.some((p) => selectedIds.has(p.id))

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const p of filtered) next.delete(p.id)
      } else {
        for (const p of filtered) next.add(p.id)
      }
      return next
    })
  }

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
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar')
    }
  }

  const handleExport = async () => {
    if (selectedIds.size === 0) {
      toast.error('Selecione ao menos uma pergunta para exportar.')
      return
    }
    setExporting(true)
    try {
      const res = await fetch('/api/admin/questions/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourseId,
          ids: Array.from(selectedIds),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao exportar')

      const file = data.file as QuestionTransferFile
      const blob = new Blob([JSON.stringify(file, null, 2)], {
        type: 'application/json',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const stamp = new Date().toISOString().slice(0, 10)
      const slug = file.courseSlug || 'perguntas'
      a.href = url
      a.download = `perguntas-${slug}-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)

      toast.success(`${data.exported} pergunta(s) exportada(s).`)
      if (data.missing > 0) {
        toast.error(`${data.missing} selecionada(s) não foram encontradas.`)
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao exportar')
    } finally {
      setExporting(false)
    }
  }

  const handleImportFile = async (file: File) => {
    setImporting(true)
    try {
      const text = await file.text()
      let parsed: unknown
      try {
        parsed = JSON.parse(text)
      } catch {
        throw new Error('Arquivo JSON inválido')
      }

      const res = await fetch('/api/admin/questions/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourseId,
          file: parsed,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao importar')

      setImportResult({
        total: data.total ?? 0,
        imported: data.imported ?? 0,
        skipped: data.skipped ?? 0,
        errors: data.errors ?? 0,
        sourceCourseSlug: data.sourceCourseSlug,
        courseName: data.courseName,
        skippedQuestions: data.skippedQuestions ?? [],
        errorQuestions: data.errorQuestions ?? [],
      })

      if (data.imported > 0) {
        toast.success(`${data.imported} pergunta(s) importada(s).`)
        await load()
      } else if (data.skipped > 0 && data.errors === 0) {
        toast('Nenhuma pergunta nova: todas já existiam.', { icon: 'ℹ️' })
      } else {
        toast.error('Nenhuma pergunta foi importada.')
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao importar')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  if (courseLoading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Banco de Perguntas</h1>
          {activeCourse?.name ? (
            <p className="text-sm text-gray-500 mt-1">Curso: {activeCourse.name}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            ref={fileInputRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) void handleImportFile(file)
            }}
          />
          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing || !activeCourseId}
          >
            <Upload className="h-4 w-4 mr-2" />
            {importing ? 'Importando…' : 'Importar'}
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleExport()}
            disabled={exporting || selectedIds.size === 0}
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando…' : `Exportar${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
          </Button>
          <Link href="/admin/perguntas/nova">
            <Button variant="primary">Nova Pergunta</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 bg-white p-4 rounded-lg shadow-sm">
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
            { value: 'Todos', label: 'Todos os formatos' },
            { value: 'MULTIPLE_CHOICE', label: 'Múltipla escolha' },
            { value: 'DISCURSIVE', label: 'Discursiva' },
          ]}
          value={formatFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormatFilter(e.target.value)}
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

      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between gap-3 bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-sm">
          <span>
            <strong>{selectedIds.size}</strong> pergunta(s) selecionada(s)
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
            Limpar seleção
          </Button>
        </div>
      )}

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
                  <TableHead className="w-10">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300"
                      checked={allFilteredSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = someFilteredSelected && !allFilteredSelected
                      }}
                      onChange={toggleAllFiltered}
                      aria-label="Selecionar todas as perguntas filtradas"
                    />
                  </TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Formato</TableHead>
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
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300"
                        checked={selectedIds.has(p.id)}
                        onChange={() => toggleOne(p.id)}
                        aria-label={`Selecionar pergunta: ${p.question_text.slice(0, 40)}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.type === 'PROVA' ? 'default' : 'info'}>{p.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={p.format === 'DISCURSIVE' ? 'info' : 'default'}>
                        {p.format === 'DISCURSIVE' ? 'Discursiva' : 'Objetiva'}
                      </Badge>
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
                    <TableCell colSpan={8} className="text-center py-8 text-gray-500">
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

      <Modal
        isOpen={Boolean(importResult)}
        onClose={() => setImportResult(null)}
        title="Resultado da importação"
        size="lg"
      >
        {importResult && (
          <div className="space-y-4 text-sm">
            <p>
              Destino: <strong>{importResult.courseName || 'curso ativo'}</strong>
              {importResult.sourceCourseSlug
                ? ` · origem no arquivo: ${importResult.sourceCourseSlug}`
                : null}
            </p>
            <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <li className="rounded-lg bg-muted px-3 py-2">
                <div className="text-xs text-gray-500">No arquivo</div>
                <div className="text-lg font-semibold">{importResult.total}</div>
              </li>
              <li className="rounded-lg bg-green-50 px-3 py-2">
                <div className="text-xs text-gray-500">Importadas</div>
                <div className="text-lg font-semibold text-green-700">
                  {importResult.imported}
                </div>
              </li>
              <li className="rounded-lg bg-amber-50 px-3 py-2">
                <div className="text-xs text-gray-500">Já existiam</div>
                <div className="text-lg font-semibold text-amber-700">
                  {importResult.skipped}
                </div>
              </li>
              <li className="rounded-lg bg-red-50 px-3 py-2">
                <div className="text-xs text-gray-500">Erros</div>
                <div className="text-lg font-semibold text-red-700">
                  {importResult.errors}
                </div>
              </li>
            </ul>

            {importResult.skippedQuestions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">
                  Desconsideradas (já existiam)
                </h3>
                <ul className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-3 bg-amber-50/50">
                  {importResult.skippedQuestions.map((item) => (
                    <li key={`skip-${item.index}`} className="text-amber-900">
                      <span className="font-medium">#{item.index}</span> —{' '}
                      {item.question_text || '(sem texto)'}
                      <div className="text-xs text-amber-800/80">{item.reason}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {importResult.errorQuestions.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">Com erro</h3>
                <ul className="max-h-48 overflow-y-auto space-y-2 border rounded-lg p-3 bg-red-50/50">
                  {importResult.errorQuestions.map((item) => (
                    <li key={`err-${item.index}`} className="text-red-900">
                      <span className="font-medium">#{item.index}</span> —{' '}
                      {item.question_text || item.reason}
                      {item.question_text ? (
                        <div className="text-xs text-red-800/80">{item.reason}</div>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="primary" onClick={() => setImportResult(null)}>
                Fechar
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
