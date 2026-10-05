'use client'

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

type Dimension = {
  id: string
  name: string
  description: string | null
  target_percentage: number
  active: boolean
  _count?: { questions: number }
  activeQuestions?: number
}

type ThemeQuestion = {
  id: string
  type: string
  question_text: string
  active: boolean
  created_at: string
}

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'
type EditableField = 'name' | 'description' | 'pct'

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500']

const cellDisplayClass =
  'w-full text-left px-2 py-1.5 rounded-lg border border-transparent hover:border-border hover:bg-slate-50 cursor-text transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary'
const cellInputClass =
  'w-full px-2 py-1.5 border border-border rounded-lg text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary'

function parseIntPct(raw: string): number | null {
  if (raw.trim() === '') return null
  if (!/^\d+$/.test(raw.trim())) return null
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > 100) return null
  return n
}

const EMPTY_FORM = {
  name: '',
  description: '',
  target_percentage: '0',
}

function AdminDimensoesContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [createOpen, setCreateOpen] = useState(false)
  const [questionsTheme, setQuestionsTheme] = useState<Dimension | null>(null)
  const [themeQuestions, setThemeQuestions] = useState<ThemeQuestion[]>([])
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingDist, setSavingDist] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [dimensoes, setDimensoes] = useState<Dimension[]>([])
  const [pctDrafts, setPctDrafts] = useState<Record<string, string>>({})
  const [savedPcts, setSavedPcts] = useState<Record<string, number>>({})
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({})
  const [descDrafts, setDescDrafts] = useState<Record<string, string>>({})
  const [editingCell, setEditingCell] = useState<{
    id: string
    field: EditableField
  } | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const savedLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const saveSeqRef = useRef(0)
  const dirtyRef = useRef(false)
  const draftTotalRef = useRef(0)
  const nameDraftsRef = useRef(nameDrafts)
  const descDraftsRef = useRef(descDrafts)
  const savedMetaRef = useRef<Record<string, { name: string; description: string }>>({})
  nameDraftsRef.current = nameDrafts
  descDraftsRef.current = descDrafts

  const load = useCallback(async () => {
    try {
      const [dRes, qRes] = await Promise.all([
        fetch('/api/admin/dimensions'),
        fetch('/api/admin/questions'),
      ])
      if (!dRes.ok) throw new Error('Falha ao carregar temas')
      const dData = await dRes.json()
      const qData = qRes.ok ? await qRes.json() : { questions: [] }
      const questions = qData.questions ?? []
      const dims = (dData.dimensions ?? []).map((d: Dimension) => ({
        ...d,
        target_percentage: Math.round(Number(d.target_percentage) || 0),
        activeQuestions: questions.filter(
          (q: { dimension_id: string; active: boolean }) =>
            q.dimension_id === d.id && q.active
        ).length,
      }))
      setDimensoes(dims)
      const drafts: Record<string, string> = {}
      const saved: Record<string, number> = {}
      const names: Record<string, string> = {}
      const descs: Record<string, string> = {}
      const meta: Record<string, { name: string; description: string }> = {}
      for (const d of dims) {
        const pct = Math.round(Number(d.target_percentage) || 0)
        drafts[d.id] = String(pct)
        saved[d.id] = pct
        names[d.id] = d.name
        descs[d.id] = d.description ?? ''
        meta[d.id] = { name: d.name, description: d.description ?? '' }
      }
      setPctDrafts(drafts)
      setSavedPcts(saved)
      setNameDrafts(names)
      setDescDrafts(descs)
      savedMetaRef.current = meta
      setSaveStatus('idle')
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar temas'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [load])

  const loadThemeQuestions = useCallback(async (dimensionId: string) => {
    setLoadingQuestions(true)
    try {
      const res = await fetch(
        `/api/admin/questions?dimension_id=${encodeURIComponent(dimensionId)}`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error('Falha ao carregar perguntas do tema')
      const data = await res.json()
      setThemeQuestions(data.questions ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar perguntas')
      setThemeQuestions([])
    } finally {
      setLoadingQuestions(false)
    }
  }, [])

  // themeId na URL controla o modal (abre ao voltar de criar/editar; fecha sem reabrir)
  useEffect(() => {
    if (loading) return
    const themeId = searchParams.get('themeId')
    if (!themeId) {
      setQuestionsTheme(null)
      setThemeQuestions([])
      return
    }
    const d = dimensoes.find((x) => x.id === themeId)
    if (!d) {
      setQuestionsTheme(null)
      setThemeQuestions([])
      return
    }
    setQuestionsTheme(d)
    void loadThemeQuestions(d.id)
  }, [loading, dimensoes, searchParams, loadThemeQuestions])

  const openQuestions = (d: Dimension) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('themeId', d.id)
    router.replace(`/admin/temas?${params.toString()}`, { scroll: false })
  }

  const closeQuestions = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('themeId')
    const qs = params.toString()
    router.replace(qs ? `/admin/temas?${qs}` : '/admin/temas', {
      scroll: false,
    })
  }

  const openCreate = () => {
    setForm(EMPTY_FORM)
    setCreateOpen(true)
  }

  const closeThemeModal = () => {
    setCreateOpen(false)
    setForm(EMPTY_FORM)
  }

  const startEditing = (id: string, field: EditableField) => {
    setEditingCell({ id, field })
  }

  const cancelEditing = (id: string, field: EditableField) => {
    const saved = savedMetaRef.current[id]
    if (field === 'name' && saved) {
      setNameDrafts((prev) => ({ ...prev, [id]: saved.name }))
    }
    if (field === 'description' && saved) {
      setDescDrafts((prev) => ({ ...prev, [id]: saved.description }))
    }
    if (field === 'pct') {
      setPctDrafts((prev) => ({
        ...prev,
        [id]: String(savedPcts[id] ?? 0),
      }))
    }
    setEditingCell(null)
  }

  const persistThemeFields = useCallback(async (id: string) => {
    const name = (nameDraftsRef.current[id] ?? '').trim()
    const description = (descDraftsRef.current[id] ?? '').trim()
    const saved = savedMetaRef.current[id]
    if (!saved) return
    if (name === saved.name && description === saved.description) return

    if (name.length < 3) {
      toast.error('Informe um nome com pelo menos 3 caracteres')
      setNameDrafts((prev) => ({ ...prev, [id]: saved.name }))
      return
    }

    setSaveStatus('saving')
    try {
      const res = await fetch('/api/admin/dimensions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name,
          description: description || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar tema')

      const nextName = data.dimension?.name ?? name
      const nextDesc =
        data.dimension?.description ?? (description || null)

      savedMetaRef.current[id] = {
        name: nextName,
        description: nextDesc ?? '',
      }
      setNameDrafts((prev) => ({ ...prev, [id]: nextName }))
      setDescDrafts((prev) => ({ ...prev, [id]: nextDesc ?? '' }))
      setDimensoes((prev) =>
        prev.map((d) =>
          d.id === id
            ? { ...d, name: nextName, description: nextDesc }
            : d
        )
      )
      setQuestionsTheme((prev) =>
        prev?.id === id
          ? { ...prev, name: nextName, description: nextDesc }
          : prev
      )
      setSaveStatus('saved')
      if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
      savedLabelTimer.current = setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (e: unknown) {
      setSaveStatus(dirtyRef.current ? 'dirty' : 'idle')
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar tema')
      setNameDrafts((prev) => ({ ...prev, [id]: saved.name }))
      setDescDrafts((prev) => ({ ...prev, [id]: saved.description }))
    }
  }, [])

  const commitCellEdit = async (id: string, field: EditableField) => {
    if (field === 'name' || field === 'description') {
      await persistThemeFields(id)
    }
    setEditingCell((current) =>
      current?.id === id && current.field === field ? null : current
    )
  }

  const onCellKeyDown = (
    e: KeyboardEvent<HTMLInputElement>,
    id: string,
    field: EditableField
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      void commitCellEdit(id, field)
    } else if (e.key === 'Escape') {
      e.preventDefault()
      cancelEditing(id, field)
    }
  }

  const activeDims = useMemo(() => dimensoes.filter((d) => d.active), [dimensoes])

  const draftTotal = useMemo(() => {
    return activeDims.reduce((sum, d) => {
      const n = parseIntPct(pctDrafts[d.id] ?? '')
      return sum + (n ?? 0)
    }, 0)
  }, [activeDims, pctDrafts])

  const allDraftsValid = useMemo(() => {
    return activeDims.every((d) => parseIntPct(pctDrafts[d.id] ?? '') !== null)
  }, [activeDims, pctDrafts])

  const isDirty = useMemo(() => {
    return dimensoes.some((d) => {
      const draft = parseIntPct(pctDrafts[d.id] ?? '')
      if (draft === null) return (pctDrafts[d.id] ?? '') !== String(savedPcts[d.id] ?? 0)
      return draft !== (savedPcts[d.id] ?? 0)
    })
  }, [dimensoes, pctDrafts, savedPcts])

  dirtyRef.current = isDirty
  draftTotalRef.current = draftTotal

  const canSaveDistribution =
    isDirty && allDraftsValid && activeDims.length > 0 && draftTotal === 100

  useEffect(() => {
    if (isDirty) setSaveStatus((s) => (s === 'saved' || s === 'idle' ? 'dirty' : s))
    else if (saveStatus === 'dirty') setSaveStatus('idle')
  }, [isDirty, saveStatus])

  // Aviso ao fechar/atualizar a aba
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!dirtyRef.current) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [])

  // Aviso ao navegar por links internos com alterações não salvas
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!dirtyRef.current) return
      const target = e.target as HTMLElement | null
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null
      if (!anchor) return
      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return
      if (anchor.target === '_blank') return
      const leave = window.confirm(
        'A distribuição ainda não foi salva' +
          (draftTotalRef.current === 100
            ? '.'
            : `, pois a soma dos percentuais não é 100% (atual: ${draftTotalRef.current}%).`) +
          '\n\nSe sair agora, as alterações serão perdidas. Deseja sair sem salvar?'
      )
      if (!leave) {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('click', onClick, true)
    return () => document.removeEventListener('click', onClick, true)
  }, [])

  const handlePercentageChange = (id: string, value: string) => {
    // Aceita só dígitos (inteiros); bloqueia vírgula/ponto
    const cleaned = value.replace(/[^\d]/g, '').slice(0, 3)
    setPctDrafts((prev) => ({ ...prev, [id]: cleaned }))
    setSaveStatus('dirty')
  }

  const saveDistribution = useCallback(async () => {
    // Só persiste com soma 100% e rascunhos válidos — sem toast enquanto edita
    if (!isDirty || !allDraftsValid || activeDims.length === 0 || draftTotal !== 100) {
      return
    }

    const distributions = dimensoes.map((d) => ({
      id: d.id,
      target_percentage: parseIntPct(pctDrafts[d.id] ?? '0') ?? 0,
    }))

    const seq = ++saveSeqRef.current
    setSavingDist(true)
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/admin/dimensions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ distributions }),
      })
      const data = await res.json().catch(() => ({}))
      if (seq !== saveSeqRef.current) return

      if (!res.ok) {
        setSaveStatus('dirty')
        return
      }

      const nextSaved: Record<string, number> = {}
      for (const d of distributions) {
        nextSaved[d.id] = d.target_percentage
      }
      setSavedPcts(nextSaved)
      setDimensoes((prev) =>
        prev.map((d) => ({
          ...d,
          target_percentage: nextSaved[d.id] ?? d.target_percentage,
        }))
      )

      // Se o usuário continuou editando, mantém o rascunho atual
      let draftsStillMatch = true
      setPctDrafts((prev) => {
        draftsStillMatch = distributions.every(
          (d) => parseIntPct(prev[d.id] ?? '') === d.target_percentage
        )
        if (!draftsStillMatch) return prev
        const next = { ...prev }
        for (const d of distributions) next[d.id] = String(d.target_percentage)
        return next
      })

      if (draftsStillMatch) {
        setSaveStatus('saved')
        if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
        savedLabelTimer.current = setTimeout(() => setSaveStatus('idle'), 1500)
      } else {
        setSaveStatus('dirty')
      }
    } catch {
      if (seq === saveSeqRef.current) setSaveStatus('dirty')
    } finally {
      if (seq === saveSeqRef.current) setSavingDist(false)
    }
  }, [
    activeDims.length,
    allDraftsValid,
    dimensoes,
    draftTotal,
    isDirty,
    pctDrafts,
  ])

  // Autosave com debounce: só quando a soma fecha em 100%
  useEffect(() => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    if (!canSaveDistribution) return

    autosaveTimer.current = setTimeout(() => {
      void saveDistribution()
    }, 500)

    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    }
  }, [canSaveDistribution, pctDrafts, saveDistribution])

  const discardDrafts = () => {
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current)
    saveSeqRef.current += 1
    setSavingDist(false)
    const drafts: Record<string, string> = {}
    for (const [id, pct] of Object.entries(savedPcts)) {
      drafts[id] = String(pct)
    }
    setPctDrafts(drafts)
    setSaveStatus('idle')
    toast('Alterações descartadas — percentuais restaurados.', { icon: '↩️' })
  }

  const toggleActive = async (d: Dimension) => {
    if (isDirty) {
      const ok = window.confirm(
        'A distribuição ainda não foi salva' +
          (draftTotal !== 100
            ? `, pois a soma dos percentuais não é 100% (atual: ${draftTotal}%).`
            : '.') +
          '\n\nAtivar ou desativar um tema agora mantém essas alterações em rascunho. Continuar?'
      )
      if (!ok) return
    }
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/admin/dimensions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, active: !d.active }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Não foi possível atualizar o status')
      setDimensoes((prev) =>
        prev.map((row) => (row.id === d.id ? { ...row, active: !d.active } : row))
      )
      setSaveStatus(isDirty ? 'dirty' : 'saved')
      if (!isDirty) {
        if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
        savedLabelTimer.current = setTimeout(() => setSaveStatus('idle'), 1500)
      }
    } catch (e: unknown) {
      setSaveStatus(isDirty ? 'dirty' : 'idle')
      toast(e instanceof Error ? e.message : 'Não foi possível atualizar o status', { icon: 'ℹ️' })
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do tema')
      return
    }
    const pct = parseIntPct(form.target_percentage)
    if (pct === null) {
      toast.error('Percentual deve ser um número inteiro entre 0 e 100')
      return
    }
    if (isDirty) {
      const ok = window.confirm(
        'A distribuição ainda não foi salva' +
          (draftTotal !== 100
            ? `, pois a soma dos percentuais não é 100% (atual: ${draftTotal}%).`
            : '.') +
          '\n\nCriar um tema agora não salva esses percentuais. Continuar?'
      )
      if (!ok) return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/dimensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          target_percentage: pct,
          display_order: dimensoes.length,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar tema')
      toast.success('Tema criado. Ajuste a distribuição para somar 100% e salve.')
      closeThemeModal()
      setLoading(true)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar tema')
    } finally {
      setSaving(false)
    }
  }

  const toggleQuestionActive = async (q: ThemeQuestion) => {
    try {
      const res = await fetch(`/api/admin/questions/${q.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !q.active }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar pergunta')
      setThemeQuestions((prev) =>
        prev.map((row) =>
          row.id === q.id ? { ...row, active: !q.active } : row
        )
      )
      if (questionsTheme) {
        setDimensoes((prev) =>
          prev.map((d) => {
            if (d.id !== questionsTheme.id) return d
            const delta = q.active ? -1 : 1
            return {
              ...d,
              activeQuestions: Math.max(0, (d.activeQuestions ?? 0) + delta),
            }
          })
        )
      }
      toast.success(`Pergunta ${q.active ? 'desativada' : 'ativada'}.`)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar pergunta')
    }
  }

  const returnToThemes = questionsTheme
    ? `/admin/temas?themeId=${encodeURIComponent(questionsTheme.id)}`
    : '/admin/temas'

  const statusLabel =
    saveStatus === 'saving'
      ? 'Salvando…'
      : saveStatus === 'saved'
        ? 'Salvo'
        : 'Clique nos campos para editar — percentuais salvam ao somar 100%'

  const displayPct = (id: string) => {
    const n = parseIntPct(pctDrafts[id] ?? '')
    return n ?? 0
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Temas</h1>
          <p
            className={`text-sm mt-1 ${
              saveStatus === 'saving'
                ? 'text-slate-600'
                : saveStatus === 'saved'
                  ? 'text-green-600'
                  : 'text-slate-500'
            }`}
          >
            {statusLabel}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {isDirty && (
            <Button variant="ghost" onClick={discardDrafts} disabled={savingDist}>
              Descartar alterações
            </Button>
          )}
          <Button variant="outline" onClick={openCreate}>
            Novo Tema
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-2 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-2">Distribuição alvo</h3>
          {activeDims.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum tema cadastrado ainda.</p>
          ) : (
            <>
              <div className="flex h-6 rounded-full overflow-hidden w-full bg-gray-200">
                {activeDims
                  .filter((d) => displayPct(d.id) > 0)
                  .map((d, i) => (
                    <div
                      key={d.id}
                      className={COLORS[i % COLORS.length]}
                      style={{ width: `${Math.min(100, displayPct(d.id))}%` }}
                      title={`${d.name}: ${displayPct(d.id)}%`}
                    />
                  ))}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600">
                {activeDims.map((d, i) => (
                  <span key={d.id} className="flex items-center">
                    <div
                      className={`w-3 h-3 ${COLORS[i % COLORS.length]} rounded-full mr-1`}
                    />
                    {d.name} ({displayPct(d.id)}%)
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
        <div className="p-4 rounded-lg shadow-sm border border-slate-100 bg-slate-50 flex flex-col justify-center">
          <h3 className="font-semibold mb-1">Total: {draftTotal}%</h3>
          <p
            className={`text-sm ${
              activeDims.length === 0
                ? 'text-gray-600'
                : draftTotal === 100
                  ? 'text-green-600'
                  : 'text-red-600'
            }`}
          >
            {activeDims.length === 0
              ? 'Cadastre temas para montar a distribuição das provas.'
              : draftTotal === 100 && isDirty
                ? 'Soma 100% — salvando automaticamente…'
                : draftTotal === 100
                  ? 'Distribuição salva: a soma está em 100%.'
                  : 'A distribuição só é salva automaticamente quando a soma for 100%.'}
          </p>
        </div>
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
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-36">Aplicação (%)</TableHead>
                <TableHead>Perguntas Ativas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dimensoes.map((d) => {
                const editingName =
                  editingCell?.id === d.id && editingCell.field === 'name'
                const editingDesc =
                  editingCell?.id === d.id && editingCell.field === 'description'
                const editingPct =
                  editingCell?.id === d.id && editingCell.field === 'pct'
                const nameValue = nameDrafts[d.id] ?? d.name
                const descValue = descDrafts[d.id] ?? d.description ?? ''
                const pctValue = pctDrafts[d.id] ?? String(d.target_percentage)

                return (
                <TableRow key={d.id}>
                  <TableCell className="min-w-[10rem]">
                    {editingName ? (
                      <input
                        type="text"
                        autoFocus
                        aria-label={`Nome do tema ${d.name}`}
                        className={`${cellInputClass} font-medium`}
                        value={nameValue}
                        onChange={(e) =>
                          setNameDrafts((prev) => ({
                            ...prev,
                            [d.id]: e.target.value,
                          }))
                        }
                        onBlur={() => void commitCellEdit(d.id, 'name')}
                        onKeyDown={(e) => onCellKeyDown(e, d.id, 'name')}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`${cellDisplayClass} font-medium`}
                        title="Clique para editar"
                        onClick={() => startEditing(d.id, 'name')}
                      >
                        {nameValue}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="min-w-[12rem]">
                    {editingDesc ? (
                      <input
                        type="text"
                        autoFocus
                        aria-label={`Descrição do tema ${d.name}`}
                        placeholder="Descrição"
                        className={`${cellInputClass} text-sm`}
                        value={descValue}
                        onChange={(e) =>
                          setDescDrafts((prev) => ({
                            ...prev,
                            [d.id]: e.target.value,
                          }))
                        }
                        onBlur={() => void commitCellEdit(d.id, 'description')}
                        onKeyDown={(e) => onCellKeyDown(e, d.id, 'description')}
                      />
                    ) : (
                      <button
                        type="button"
                        className={`${cellDisplayClass} text-sm text-gray-500`}
                        title="Clique para editar"
                        onClick={() => startEditing(d.id, 'description')}
                      >
                        {descValue || '—'}
                      </button>
                    )}
                  </TableCell>
                  <TableCell className="w-36">
                    {editingPct ? (
                      <div className="flex items-center gap-1 max-w-[7rem]">
                        <input
                          type="number"
                          autoFocus
                          min={0}
                          max={100}
                          step={1}
                          inputMode="numeric"
                          aria-label={`Percentual de aplicação de ${d.name}`}
                          className={cellInputClass}
                          value={pctValue}
                          onChange={(e) =>
                            handlePercentageChange(d.id, e.target.value)
                          }
                          onBlur={() => void commitCellEdit(d.id, 'pct')}
                          onKeyDown={(e) => {
                            if (['.', ',', 'e', 'E', '+', '-'].includes(e.key)) {
                              e.preventDefault()
                              return
                            }
                            onCellKeyDown(e, d.id, 'pct')
                          }}
                        />
                        <span className="text-sm text-slate-500">%</span>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className={`${cellDisplayClass} max-w-[7rem]`}
                        title="Clique para editar"
                        onClick={() => startEditing(d.id, 'pct')}
                      >
                        {pctValue}%
                      </button>
                    )}
                  </TableCell>
                  <TableCell>{d.activeQuestions ?? 0}</TableCell>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => void toggleActive(d)}
                      className="focus:outline-none"
                      title={d.active ? 'Desativar tema' : 'Ativar tema'}
                    >
                      <Badge variant={d.active ? 'success' : 'default'}>
                        {d.active ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </button>
                  </TableCell>
                  <TableCell className="text-right whitespace-nowrap">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openQuestions(d)}
                    >
                      Perguntas
                    </Button>
                  </TableCell>
                </TableRow>
                )
              })}
              {dimensoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                    Nenhum tema cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        isOpen={createOpen}
        onClose={closeThemeModal}
        title="Novo Tema"
      >
        <div className="space-y-4">
          <Input
            label="Nome do Tema"
            placeholder="Ex: Redes Sociais"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
          />
          <Input
            label="Descrição"
            placeholder="Breve descrição"
            value={form.description}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, description: e.target.value }))
            }
          />
          <Input
            label="Percentual de aplicação (%)"
            type="number"
            min="0"
            max="100"
            step="1"
            inputMode="numeric"
            value={form.target_percentage}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({
                ...f,
                target_percentage: e.target.value.replace(/[^\d]/g, '').slice(0, 3),
              }))
            }
            helperText="Inteiro de 0 a 100 — ajuste depois na tabela se precisar"
          />
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="ghost" onClick={closeThemeModal}>
              Cancelar
            </Button>
            <Button
              variant="primary"
              loading={saving}
              onClick={() => void handleCreate()}
            >
              Salvar
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={questionsTheme != null}
        onClose={closeQuestions}
        title={
          questionsTheme
            ? `Perguntas — ${questionsTheme.name}`
            : 'Perguntas do tema'
        }
        size="full"
      >
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">
              {questionsTheme?.description
                ? questionsTheme.description
                : 'Liste, edite ou crie perguntas deste tema.'}
            </p>
            {questionsTheme ? (
              <Link
                href={`/admin/perguntas/nova?dimension_id=${encodeURIComponent(questionsTheme.id)}&returnTo=${encodeURIComponent(returnToThemes)}`}
              >
                <Button variant="primary" size="sm">
                  Nova pergunta
                </Button>
              </Link>
            ) : null}
          </div>

          {loadingQuestions ? (
            <div className="flex justify-center p-10">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Pergunta</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {themeQuestions.map((q) => (
                    <TableRow key={q.id}>
                      <TableCell className="max-w-md">
                        <p className="line-clamp-2 text-sm">{q.question_text}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={q.type === 'PROVA' ? 'default' : 'info'}>
                          {q.type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <button
                          type="button"
                          onClick={() => void toggleQuestionActive(q)}
                          className="focus:outline-none"
                        >
                          <Badge variant={q.active ? 'success' : 'default'}>
                            {q.active ? 'Ativa' : 'Inativa'}
                          </Badge>
                        </button>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link
                          href={`/admin/perguntas/${q.id}?returnTo=${encodeURIComponent(returnToThemes)}`}
                        >
                          <Button size="sm" variant="outline">
                            Editar
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                  {themeQuestions.length === 0 && (
                    <TableRow>
                      <TableCell
                        colSpan={4}
                        className="text-center py-8 text-gray-500"
                      >
                        Nenhuma pergunta neste tema ainda.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}

export default function AdminDimensoesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <AdminDimensoesContent />
    </Suspense>
  )
}
