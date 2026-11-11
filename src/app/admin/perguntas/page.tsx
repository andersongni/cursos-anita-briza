'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import Modal from '@/components/ui/Modal'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Download, Pencil, Trash2, Upload, Eraser } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'
import { useAdminCourse } from '@/components/courses/AdminCourseProvider'
import type { QuestionTransferFile } from '@/lib/assessment/question-transfer'

const DEFAULT_TYPE = 'Todos'
const DEFAULT_FORMAT = 'Todos'
const DEFAULT_THEME = 'Todos'
const DEFAULT_STATUS = 'Ativas'

function buildPerguntasListPath(filters: {
  searchTerm: string
  typeFilter: string
  formatFilter: string
  themeFilter: string
  statusFilter: string
}) {
  const params = new URLSearchParams()
  const q = filters.searchTerm.trim()
  if (q) params.set('q', q)
  if (filters.typeFilter !== DEFAULT_TYPE) params.set('type', filters.typeFilter)
  if (filters.formatFilter !== DEFAULT_FORMAT) params.set('format', filters.formatFilter)
  if (filters.themeFilter !== DEFAULT_THEME) params.set('theme', filters.themeFilter)
  if (filters.statusFilter !== DEFAULT_STATUS) params.set('status', filters.statusFilter)
  const qs = params.toString()
  return qs ? `/admin/perguntas?${qs}` : '/admin/perguntas'
}

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

function AdminPerguntasContent() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeCourseId, activeCourse, loading: courseLoading } = useAdminCourse()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') ?? '')
  const [typeFilter, setTypeFilter] = useState(
    () => searchParams.get('type') ?? DEFAULT_TYPE
  )
  const [formatFilter, setFormatFilter] = useState(
    () => searchParams.get('format') ?? DEFAULT_FORMAT
  )
  const [themeFilter, setThemeFilter] = useState(
    () => searchParams.get('theme') ?? DEFAULT_THEME
  )
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get('status') ?? DEFAULT_STATUS
  )
  const [loading, setLoading] = useState(true)
  const [perguntas, setPerguntas] = useState<Question[]>([])
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [purging, setPurging] = useState(false)
  const [purgeModalOpen, setPurgeModalOpen] = useState(false)
  const [purgeConfirmText, setPurgeConfirmText] = useState('')
  const [importResult, setImportResult] = useState<ImportResult | null>(null)

  const downloadTransferFile = (file: QuestionTransferFile, filenamePrefix: string) => {
    const blob = new Blob([JSON.stringify(file, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    const stamp = new Date().toISOString().slice(0, 10)
    const slug = file.courseSlug || 'perguntas'
    a.href = url
    a.download = `${filenamePrefix}-${slug}-${stamp}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const listPath = useMemo(
    () =>
      buildPerguntasListPath({
        searchTerm,
        typeFilter,
        formatFilter,
        themeFilter,
        statusFilter,
      }),
    [searchTerm, typeFilter, formatFilter, themeFilter, statusFilter]
  )

  // Mantém os filtros na URL para sobreviver à navegação (editar → voltar).
  useEffect(() => {
    const current = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`
    if (current === listPath) return
    router.replace(listPath, { scroll: false })
  }, [listPath, pathname, router, searchParams])

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
      const matchesType = typeFilter === DEFAULT_TYPE || p.type === typeFilter
      const format = p.format === 'DISCURSIVE' ? 'DISCURSIVE' : 'MULTIPLE_CHOICE'
      const matchesFormat = formatFilter === DEFAULT_FORMAT || format === formatFilter
      const matchesTheme =
        themeFilter === DEFAULT_THEME ||
        p.dimension?.id === themeFilter ||
        p.dimension?.name === themeFilter
      const matchesStatus =
        statusFilter === 'Todas' ||
        (statusFilter === DEFAULT_STATUS && p.active) ||
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

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta pergunta? Se ela já foi usada em avaliações, será apenas desativada.')) {
      return
    }
    try {
      const res = await fetch(`/api/admin/questions/${id}`, { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir')
      toast.success(data.message || 'Pergunta excluída.')
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir')
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
      downloadTransferFile(file, 'perguntas')

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

  const openPurgeModal = () => {
    if (!activeCourseId || perguntas.length === 0) {
      toast.error('Não há perguntas neste curso para remover.')
      return
    }
    setPurgeConfirmText('')
    setPurgeModalOpen(true)
  }

  const handlePurgeAll = async () => {
    if (!activeCourseId) return
    if (purgeConfirmText.trim().toUpperCase() !== 'APAGAR') {
      toast.error('Digite APAGAR para confirmar.')
      return
    }

    setPurging(true)
    try {
      // 1) Backup obrigatório (mesmo formato da exportação) — só apaga depois do download
      const exportRes = await fetch('/api/admin/questions/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourseId,
          all: true,
        }),
      })
      const exportData = await exportRes.json()
      if (!exportRes.ok) {
        throw new Error(exportData.error || 'Falha ao gerar o backup')
      }

      const file = exportData.file as QuestionTransferFile
      if (!file?.questions?.length) {
        throw new Error('Backup vazio — exclusão cancelada')
      }
      downloadTransferFile(file, 'backup-perguntas')
      toast.success(`Backup baixado (${exportData.exported} pergunta(s)).`)

      // 2) Só então remove as perguntas do curso selecionado
      const purgeRes = await fetch('/api/admin/questions/purge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourseId,
          confirm: 'APAGAR',
        }),
      })
      const purgeData = await purgeRes.json()
      if (!purgeRes.ok) {
        throw new Error(
          purgeData.error ||
            'Backup baixado, mas a exclusão falhou. Reimporte o arquivo se necessário.'
        )
      }

      toast.success(purgeData.message || `${purgeData.deleted} pergunta(s) removida(s).`)
      setPurgeModalOpen(false)
      setPurgeConfirmText('')
      setSelectedIds(new Set())
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao esvaziar o banco')
    } finally {
      setPurging(false)
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
            disabled={exporting || selectedIds.size === 0 || purging}
          >
            <Download className="h-4 w-4 mr-2" />
            {exporting ? 'Exportando…' : `Exportar${selectedIds.size ? ` (${selectedIds.size})` : ''}`}
          </Button>
          <Button
            variant="outline"
            className="text-error border-error/30 hover:bg-error/5"
            onClick={openPurgeModal}
            disabled={purging || importing || exporting || perguntas.length === 0 || !activeCourseId}
          >
            <Eraser className="h-4 w-4 mr-2" />
            Esvaziar banco
          </Button>
          <Link
            href={`/admin/perguntas/nova?returnTo=${encodeURIComponent(listPath)}`}
          >
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
            { value: DEFAULT_TYPE, label: 'Todos os Tipos' },
            { value: 'PROVA', label: 'Prova' },
            { value: 'SIMULADO', label: 'Simulado' },
          ]}
          value={typeFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setTypeFilter(e.target.value)}
        />
        <Select
          options={[
            { value: DEFAULT_FORMAT, label: 'Todos os formatos' },
            { value: 'MULTIPLE_CHOICE', label: 'Múltipla escolha' },
            { value: 'DISCURSIVE', label: 'Discursiva' },
          ]}
          value={formatFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setFormatFilter(e.target.value)}
        />
        <Select
          options={[
            { value: DEFAULT_THEME, label: 'Todos os Temas' },
            ...dimensions.map((d) => ({ value: d.id, label: d.name })),
          ]}
          value={themeFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setThemeFilter(e.target.value)}
        />
        <Select
          options={[
            { value: 'Todas', label: 'Qualquer Status' },
            { value: DEFAULT_STATUS, label: 'Ativas' },
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
                        {p.format === 'DISCURSIVE' ? 'Discursiva' : 'Múltipla escolha'}
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
                    <TableCell className="text-right">
                      <div className="inline-flex items-center gap-1">
                        <Link
                          href={`/admin/perguntas/${p.id}?returnTo=${encodeURIComponent(listPath)}`}
                        >
                          <Button
                            size="sm"
                            variant="ghost"
                            className="px-2"
                            aria-label="Editar pergunta"
                            title="Editar"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="px-2 text-error hover:text-error"
                          onClick={() => void handleDelete(p.id)}
                          aria-label="Excluir pergunta"
                          title="Excluir"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
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
        isOpen={purgeModalOpen}
        onClose={() => {
          if (purging) return
          setPurgeModalOpen(false)
          setPurgeConfirmText('')
        }}
        title="Esvaziar banco de perguntas"
        size="md"
      >
        <div className="space-y-4 text-sm">
          <p className="text-slate-700 leading-relaxed">
            Esta ação remove <strong>todas</strong> as perguntas do curso{' '}
            <strong>{activeCourse?.name || 'selecionado'}</strong> ({perguntas.length} no
            total). Outros cursos não são afetados.
          </p>
          <p className="text-slate-700 leading-relaxed">
            Antes de apagar, o sistema gera e baixa um backup JSON (mesmo formato da
            exportação). Avaliações já feitas continuam com o enunciado em snapshot.
          </p>
          <Input
            label='Digite APAGAR para confirmar'
            value={purgeConfirmText}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setPurgeConfirmText(e.target.value)
            }
            placeholder="APAGAR"
            disabled={purging}
            autoComplete="off"
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setPurgeModalOpen(false)
                setPurgeConfirmText('')
              }}
              disabled={purging}
            >
              Cancelar
            </Button>
            <Button
              variant="primary"
              className="bg-error hover:bg-error/90"
              onClick={() => void handlePurgeAll()}
              disabled={purging || purgeConfirmText.trim().toUpperCase() !== 'APAGAR'}
              loading={purging}
            >
              {purging ? 'Backup e exclusão…' : 'Baixar backup e apagar'}
            </Button>
          </div>
        </div>
      </Modal>

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

export default function AdminPerguntasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <AdminPerguntasContent />
    </Suspense>
  )
}
