'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import {
  READONLY_CERTIFICATE_PLACEHOLDERS,
  CERT_PAGE_HEIGHT_MM,
  CERT_PAGE_WIDTH_MM,
  PLATFORM_LOGO_TOKEN,
  createDefaultCertificateLayout,
  createImageElement,
  createTextElement,
  fontSizePtToPreviewPx,
  isImageElement,
  isTextElement,
  resolveElementImageUrl,
  type CertificateLayout,
  type CertificateLayoutElement,
} from '@/lib/certificate/layout'
import {
  RESERVED_VARIABLE_KEY_SET,
  createDefaultEditableVariables,
  createEditableVariable,
  normalizeVariableKey,
  replaceVariableKeyInText,
  type CertificateEditableVariable,
} from '@/lib/certificate/variables'
import toast from 'react-hot-toast'

type Meta = {
  courseName: string
  institutionName: string
  courseHours: number
  location: string
  logoUrl: string
}

const NUDGE_STEP = 0.5
const NUDGE_STEP_LARGE = 2
const HISTORY_LIMIT = 60

function clampPct(n: number) {
  return Math.min(100, Math.max(0, n))
}

function cloneLayout(layout: CertificateLayout): CertificateLayout {
  return structuredClone(layout)
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

function isUndoKey(e: KeyboardEvent) {
  return (e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z'
}

function isRedoKey(e: KeyboardEvent) {
  return (
    ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') ||
    ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 'z')
  )
}

function elementPreviewSrc(el: CertificateLayoutElement, logoUrl?: string | null) {
  return resolveElementImageUrl(el, logoUrl) || null
}

export default function AdminCertificateTemplateEditorPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploadingBg, setUploadingBg] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [layout, setLayout] = useState<CertificateLayout>(() => createDefaultCertificateLayout())
  const [meta, setMeta] = useState<Meta | null>(null)
  const [editableVariables, setEditableVariables] = useState<CertificateEditableVariable[]>(() =>
    createDefaultEditableVariables()
  )
  /** Força remount dos inputs de chave após validação inválida. */
  const [keyInputEpoch, setKeyInputEpoch] = useState(0)
  const [selectedIds, setSelectedIds] = useState<string[]>(['intro'])
  const [dirty, setDirty] = useState(false)
  const [canUndo, setCanUndo] = useState(false)
  const [canRedo, setCanRedo] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const imageFileRef = useRef<HTMLInputElement>(null)
  const variablesTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editableVariablesRef = useRef(editableVariables)
  const [stageHeightPx, setStageHeightPx] = useState(0)

  editableVariablesRef.current = editableVariables
  const layoutRef = useRef(layout)
  const selectedIdsRef = useRef(selectedIds)
  const pastRef = useRef<CertificateLayout[]>([])
  const futureRef = useRef<CertificateLayout[]>([])
  const suppressStageClickRef = useRef(false)
  const dragRef = useRef<{
    ids: string[]
    startX: number
    startY: number
    origins: Record<string, { x: number; y: number }>
    historyPushed: boolean
  } | null>(null)

  layoutRef.current = layout
  selectedIdsRef.current = selectedIds

  const syncHistoryFlags = () => {
    setCanUndo(pastRef.current.length > 0)
    setCanRedo(futureRef.current.length > 0)
  }

  const clearHistory = () => {
    pastRef.current = []
    futureRef.current = []
    syncHistoryFlags()
  }

  const pushHistory = useCallback((snapshot?: CertificateLayout) => {
    pastRef.current.push(cloneLayout(snapshot ?? layoutRef.current))
    if (pastRef.current.length > HISTORY_LIMIT) pastRef.current.shift()
    futureRef.current = []
    syncHistoryFlags()
  }, [])

  const undo = useCallback(() => {
    const prev = pastRef.current.pop()
    if (!prev) return
    futureRef.current.push(cloneLayout(layoutRef.current))
    setLayout(prev)
    setDirty(true)
    syncHistoryFlags()
  }, [])

  const redo = useCallback(() => {
    const next = futureRef.current.pop()
    if (!next) return
    pastRef.current.push(cloneLayout(layoutRef.current))
    setLayout(next)
    setDirty(true)
    syncHistoryFlags()
  }, [])

  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const update = () => setStageHeightPx(stage.getBoundingClientRect().height)
    update()
    const ro = new ResizeObserver(update)
    ro.observe(stage)
    return () => ro.disconnect()
  }, [loading])

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/certificate-template', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar modelo')
      const data = await res.json()
      setLayout(data.layout)
      setMeta(data.meta ?? null)
      if (Array.isArray(data.editableVariables)) {
        setEditableVariables(data.editableVariables)
      } else if (data.meta) {
        setEditableVariables(
          createDefaultEditableVariables({
            institutionName: String(data.meta.institutionName ?? ''),
            courseName: String(data.meta.courseName ?? ''),
            courseHours: data.meta.courseHours ?? 40,
            location: String(data.meta.location ?? ''),
          })
        )
      }
      setDirty(false)
      clearHistory()
      setSelectedIds((prev) => {
        if (prev.length > 0) return prev
        const first = data.layout?.elements?.[0]?.id
        return first ? [first] : []
      })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar modelo')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    return () => {
      if (variablesTimer.current) clearTimeout(variablesTimer.current)
    }
  }, [load])

  const persistEditableVariables = useCallback(async (variables: CertificateEditableVariable[]) => {
    try {
      const res = await fetch('/api/admin/certificate-template/variables', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variables }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar variáveis')
      if (Array.isArray(data.variables)) {
        setEditableVariables(data.variables)
      }
      setMeta((prev) => {
        if (!prev) return prev
        const map = Object.fromEntries(
          (data.variables as CertificateEditableVariable[] | undefined ?? variables).map((v) => [
            v.key,
            v.value,
          ])
        )
        return {
          ...prev,
          institutionName: map['{institution}'] ?? prev.institutionName,
          courseName: map['{course_name}'] ?? prev.courseName,
          courseHours: Number(map['{course_hours}'] ?? prev.courseHours) || prev.courseHours,
          location: map['{location}'] ?? prev.location,
        }
      })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar variáveis')
    }
  }, [])

  const schedulePersistVariables = useCallback(
    (variables: CertificateEditableVariable[]) => {
      if (variablesTimer.current) clearTimeout(variablesTimer.current)
      variablesTimer.current = setTimeout(() => {
        void persistEditableVariables(variables)
      }, 500)
    },
    [persistEditableVariables]
  )

  const updateVariableValue = (id: string, value: string) => {
    setEditableVariables((prev) => {
      const next = prev.map((v) => (v.id === id ? { ...v, value } : v))
      schedulePersistVariables(next)
      return next
    })
  }

  const commitVariableKey = (id: string, rawKey: string) => {
    const current = editableVariablesRef.current.find((v) => v.id === id)
    if (!current) return

    const nextKey = normalizeVariableKey(rawKey)
    if (!nextKey) {
      toast.error('Chave inválida. Use letras, números ou _.')
      setKeyInputEpoch((n) => n + 1)
      return
    }
    if (RESERVED_VARIABLE_KEY_SET.has(nextKey)) {
      toast.error(`${nextKey} é reservada do sistema e não pode ser usada.`)
      setKeyInputEpoch((n) => n + 1)
      return
    }
    if (
      editableVariablesRef.current.some((v) => v.id !== id && v.key === nextKey)
    ) {
      toast.error(`A chave ${nextKey} já existe.`)
      setKeyInputEpoch((n) => n + 1)
      return
    }
    if (nextKey === current.key) {
      // Re-normaliza visualmente (ex.: usuário tirou as chaves)
      if (rawKey.trim() !== current.key) setKeyInputEpoch((n) => n + 1)
      return
    }

    const oldKey = current.key
    setEditableVariables((prev) => {
      const next = prev.map((v) => (v.id === id ? { ...v, key: nextKey } : v))
      schedulePersistVariables(next)
      return next
    })

    // Atualiza textos do layout que usavam a chave antiga
    pushHistory()
    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((el) =>
        isTextElement(el)
          ? { ...el, text: replaceVariableKeyInText(el.text, oldKey, nextKey) }
          : el
      ),
    }))
    setDirty(true)
    toast.success(`Chave atualizada para ${nextKey}. Salve o modelo para gravar os textos.`)
  }

  const addEditableVariable = () => {
    setEditableVariables((prev) => {
      const created = createEditableVariable({ value: '' }, prev)
      const next = [...prev, created]
      schedulePersistVariables(next)
      return next
    })
  }

  const removeEditableVariable = (id: string) => {
    const target = editableVariablesRef.current.find((v) => v.id === id)
    if (!target) return
    if (!window.confirm(`Remover a variável ${target.key}?`)) return
    setEditableVariables((prev) => {
      const next = prev.filter((v) => v.id !== id)
      schedulePersistVariables(next)
      return next
    })
  }

  const primaryId = selectedIds[selectedIds.length - 1] ?? null
  const selected = useMemo(
    () => layout.elements.find((e) => e.id === primaryId) ?? null,
    [layout.elements, primaryId]
  )
  const selectedCount = selectedIds.length

  const selectedElements = useMemo(
    () => layout.elements.filter((e) => selectedIds.includes(e.id)),
    [layout.elements, selectedIds]
  )

  const selectedTextElements = useMemo(
    () => selectedElements.filter(isTextElement),
    [selectedElements]
  )

  /** Tamanho compartilhado na multisseleção de textos (null = valores diferentes). */
  const multiFontSize = useMemo(() => {
    if (selectedTextElements.length === 0) return null
    const first = selectedTextElements[0].fontSize
    return selectedTextElements.every((e) => e.fontSize === first) ? first : null
  }, [selectedTextElements])

  const updateElements = (
    ids: string[],
    patch:
      | Partial<CertificateLayoutElement>
      | ((el: CertificateLayoutElement) => Partial<CertificateLayoutElement>),
    opts?: { recordHistory?: boolean }
  ) => {
    if (opts?.recordHistory !== false) pushHistory()
    const idSet = new Set(ids)
    setLayout((prev) => {
      const elements = prev.elements.map((el) => {
        if (!idSet.has(el.id)) return el
        const next = typeof patch === 'function' ? patch(el) : patch
        return { ...el, ...next }
      })
      const logo = elements.find((e) => e.id === 'logo')
      return {
        ...prev,
        elements,
        showLogo: logo ? logo.visible : prev.showLogo,
      }
    })
    setDirty(true)
  }

  const updateElement = (
    id: string,
    patch: Partial<CertificateLayoutElement>,
    opts?: { recordHistory?: boolean }
  ) => {
    updateElements([id], patch, opts)
  }

  const selectElement = (id: string, additive: boolean) => {
    setSelectedIds((prev) => {
      if (!additive) return [id]
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id)
        return next.length > 0 ? next : [id]
      }
      return [...prev, id]
    })
  }

  const addTextElement = () => {
    const el = createTextElement({
      label: 'Novo texto',
      text: 'Novo texto',
      x: 50,
      y: 45,
      fontSize: 16,
      align: 'center',
      color: '#0078a8',
      maxWidthPct: 40,
      visible: true,
    })
    pushHistory()
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }))
    setSelectedIds([el.id])
    setDirty(true)
    toast.success('Texto adicionado.')
  }

  const addImageElement = () => {
    const el = createImageElement({
      label: 'Nova imagem',
      imageUrl: PLATFORM_LOGO_TOKEN,
      x: 40,
      y: 30,
      widthPct: 15,
      heightPct: 20,
      opacity: 1,
      visible: true,
    })
    pushHistory()
    setLayout((prev) => ({ ...prev, elements: [...prev.elements, el] }))
    setSelectedIds([el.id])
    setDirty(true)
    toast.success('Imagem adicionada. Ajuste posição, tamanho ou envie outro arquivo.')
  }

  const removeSelectedElements = () => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    const label =
      ids.length === 1
        ? 'Remover este elemento do modelo?'
        : `Remover ${ids.length} elementos do modelo?`
    if (!window.confirm(label)) return
    pushHistory()
    const idSet = new Set(ids)
    setLayout((prev) => {
      const elements = prev.elements.filter((el) => !idSet.has(el.id))
      const logo = elements.find((e) => e.id === 'logo')
      return { ...prev, elements, showLogo: logo ? logo.visible : false }
    })
    setSelectedIds([])
    setDirty(true)
  }

  /** Centraliza no documento. Texto: âncora no centro; imagem: topo-esquerdo ajustado. */
  const alignSelectionToDocumentCenter = () => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) {
      toast('Selecione um ou mais elementos para centralizar.', { icon: 'ℹ️' })
      return
    }
    updateElements(ids, (el) => {
      if (isImageElement(el)) {
        return { x: clampPct((100 - el.widthPct) / 2) }
      }
      return { x: 50, align: 'center' }
    })
    toast.success(
      ids.length === 1
        ? 'Elemento alinhado ao centro horizontal.'
        : `${ids.length} elementos alinhados ao centro horizontal.`
    )
  }

  const nudgeSelection = (dx: number, dy: number) => {
    const ids = selectedIdsRef.current
    if (ids.length === 0) return
    updateElements(ids, (el) => ({
      x: clampPct(el.x + dx),
      y: clampPct(el.y + dy),
    }))
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (isUndoKey(e)) {
        if (!isEditableTarget(e.target)) {
          e.preventDefault()
          undo()
        }
        return
      }
      if (isRedoKey(e)) {
        if (!isEditableTarget(e.target)) {
          e.preventDefault()
          redo()
        }
        return
      }

      if (isEditableTarget(e.target)) return
      const ids = selectedIdsRef.current
      if (ids.length === 0) return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        removeSelectedElements()
        return
      }

      const arrow =
        e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown'
      if (!arrow) return

      e.preventDefault()
      const step = e.shiftKey ? NUDGE_STEP_LARGE : NUDGE_STEP
      if (e.key === 'ArrowLeft') nudgeSelection(-step, 0)
      if (e.key === 'ArrowRight') nudgeSelection(step, 0)
      if (e.key === 'ArrowUp') nudgeSelection(0, -step)
      if (e.key === 'ArrowDown') nudgeSelection(0, step)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undo, redo])

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/certificate-template', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      setLayout(data.layout)
      setDirty(false)
      toast.success('Modelo do certificado salvo.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar modelo')
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!window.confirm('Restaurar o layout padrão? As posições e elementos do modelo serão redefinidos.')) {
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/certificate-template', { method: 'DELETE' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao restaurar')
      setLayout(data.layout)
      setDirty(false)
      clearHistory()
      toast.success('Modelo padrão restaurado.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao restaurar modelo')
    } finally {
      setSaving(false)
    }
  }

  const handleBackgroundUpload = async (file: File | null) => {
    if (!file) return
    setUploadingBg(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/certificate-template/background', {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar fundo')
      const bg = typeof data.backgroundUrl === 'string' ? data.backgroundUrl : null
      if (bg) {
        pushHistory()
        setLayout((prev) => ({ ...prev, backgroundUrl: bg }))
        setDirty(true)
      }
      toast.success('Imagem de fundo atualizada. Salve o modelo para gravar o layout completo.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar fundo')
    } finally {
      setUploadingBg(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const handleBackgroundReset = async () => {
    setUploadingBg(true)
    try {
      const res = await fetch('/api/admin/certificate-template/background', {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao restaurar fundo')
      const bg = typeof data.backgroundUrl === 'string' ? data.backgroundUrl : null
      if (bg) {
        pushHistory()
        setLayout((prev) => ({ ...prev, backgroundUrl: bg }))
        setDirty(true)
      }
      toast.success('Fundo padrão restaurado.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao restaurar fundo')
    } finally {
      setUploadingBg(false)
    }
  }

  const handleElementImageUpload = async (file: File | null) => {
    if (!file || !selected || !isImageElement(selected)) return
    setUploadingImage(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/admin/certificate-template/element-image', {
        method: 'POST',
        body: form,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar imagem')
      const imageUrl = typeof data.imageUrl === 'string' ? data.imageUrl : null
      if (!imageUrl) throw new Error('URL da imagem não retornada')
      updateElement(selected.id, { imageUrl })
      toast.success('Imagem do elemento atualizada.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao enviar imagem')
    } finally {
      setUploadingImage(false)
      if (imageFileRef.current) imageFileRef.current.value = ''
    }
  }

  const insertPlaceholder = (key: string) => {
    if (!selected || !isTextElement(selected)) return
    updateElement(selected.id, { text: `${selected.text}${key}` })
  }

  const onPointerDown = (e: React.PointerEvent, id: string) => {
    e.preventDefault()
    e.stopPropagation()
    suppressStageClickRef.current = true

    const additive = e.ctrlKey || e.metaKey || e.shiftKey
    const current = selectedIdsRef.current

    let nextIds: string[]
    if (additive) {
      if (current.includes(id)) {
        nextIds = current.filter((x) => x !== id)
        if (nextIds.length === 0) nextIds = [id]
        setSelectedIds(nextIds)
        dragRef.current = null
        return
      }
      nextIds = [...current, id]
    } else if (current.includes(id) && current.length > 1) {
      nextIds = current
    } else {
      nextIds = [id]
    }
    setSelectedIds(nextIds)

    const origins: Record<string, { x: number; y: number }> = {}
    for (const dragId of nextIds) {
      const el = layoutRef.current.elements.find((x) => x.id === dragId)
      if (el) origins[dragId] = { x: el.x, y: el.y }
    }

    dragRef.current = {
      ids: nextIds,
      startX: e.clientX,
      startY: e.clientY,
      origins,
      historyPushed: false,
    }
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current
    const stage = stageRef.current
    if (!drag || !stage) return
    const rect = stage.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return
    const dx = ((e.clientX - drag.startX) / rect.width) * 100
    const dy = ((e.clientY - drag.startY) / rect.height) * 100

    if (!drag.historyPushed && (Math.abs(dx) > 0.05 || Math.abs(dy) > 0.05)) {
      pushHistory()
      drag.historyPushed = true
    }

    setLayout((prev) => ({
      ...prev,
      elements: prev.elements.map((el) => {
        const origin = drag.origins[el.id]
        if (!origin) return el
        return {
          ...el,
          x: clampPct(origin.x + dx),
          y: clampPct(origin.y + dy),
        }
      }),
    }))
    setDirty(true)
  }

  const onPointerUp = () => {
    dragRef.current = null
    window.setTimeout(() => {
      suppressStageClickRef.current = false
    }, 0)
  }

  const onStageClick = () => {
    if (suppressStageClickRef.current) return
    setSelectedIds([])
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh]">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Modelo do certificado</h1>
          <p className="text-sm text-slate-500 mt-1">
            <Link href="/admin/certificados" className="text-primary hover:underline">
              ← Voltar para Certificados
            </Link>
            {dirty ? ' · alterações não salvas' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" disabled={!canUndo} onClick={undo} title="Ctrl+Z">
            Desfazer
          </Button>
          <Button variant="outline" disabled={!canRedo} onClick={redo} title="Ctrl+Y">
            Refazer
          </Button>
          <Button variant="outline" loading={saving} onClick={() => void handleReset()}>
            Restaurar padrão
          </Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSave()}>
            Salvar modelo
          </Button>
        </div>
      </div>

      <div className="space-y-4">
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-4 items-start">
        {/* Visualização */}
        <section className="bg-slate-100 rounded-lg border border-slate-200 shadow-sm p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-secondary">
              Visualização
              {selectedCount > 0 && (
                <span className="ml-2 font-normal text-slate-500">
                  ({selectedCount} selecionado{selectedCount > 1 ? 's' : ''})
                </span>
              )}
            </h2>
            <div className="flex flex-wrap gap-2">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void handleBackgroundUpload(e.target.files?.[0] ?? null)}
              />
              <Button
                size="sm"
                variant="outline"
                loading={uploadingBg}
                onClick={() => fileRef.current?.click()}
              >
                Alterar fundo
              </Button>
              <Button
                size="sm"
                variant="ghost"
                loading={uploadingBg}
                onClick={() => void handleBackgroundReset()}
              >
                Fundo padrão
              </Button>
            </div>
          </div>

          <div
            ref={stageRef}
            className="relative w-full mx-auto bg-white shadow-md overflow-hidden select-none touch-none"
            style={{ aspectRatio: `${CERT_PAGE_WIDTH_MM} / ${CERT_PAGE_HEIGHT_MM}` }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
            onClick={onStageClick}
          >
            {selectedCount > 0 && (
              <div
                className="absolute top-0 bottom-0 w-px bg-sky-400/50 pointer-events-none z-10"
                style={{ left: '50%' }}
                aria-hidden
              />
            )}

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={layout.backgroundUrl || '/certificate-template.jpg'}
              alt="Fundo do certificado"
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              draggable={false}
            />

            {layout.elements
              .filter((el) => el.visible)
              .map((el) => {
                const isSelected = selectedIds.includes(el.id)

                if (isImageElement(el)) {
                  const src = elementPreviewSrc(el, meta?.logoUrl)
                  return (
                    <div
                      key={el.id}
                      role="button"
                      tabIndex={0}
                      onPointerDown={(e) => onPointerDown(e, el.id)}
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute cursor-move ${
                        isSelected
                          ? 'ring-2 ring-primary ring-offset-1'
                          : 'hover:ring-1 hover:ring-sky-300'
                      }`}
                      style={{
                        left: `${el.x}%`,
                        top: `${el.y}%`,
                        width: `${el.widthPct}%`,
                        height: `${el.heightPct}%`,
                        opacity: el.opacity,
                        zIndex: isSelected ? 20 : 1,
                      }}
                    >
                      {src ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={src}
                          alt={el.label}
                          className="w-full h-full object-contain pointer-events-none"
                          draggable={false}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200/70 text-[10px] text-slate-600">
                          Sem imagem
                        </div>
                      )}
                    </div>
                  )
                }

                return (
                  <div
                    key={el.id}
                    role="button"
                    tabIndex={0}
                    onPointerDown={(e) => onPointerDown(e, el.id)}
                    onClick={(e) => e.stopPropagation()}
                    className={`absolute cursor-move max-w-[90%] ${
                      isSelected
                        ? 'ring-2 ring-primary ring-offset-1 bg-white/30'
                        : 'hover:ring-1 hover:ring-sky-300'
                    }`}
                    style={{
                      left: `${el.x}%`,
                      top: `${el.y}%`,
                      transform:
                        el.align === 'center'
                          ? 'translate(-50%, -0.85em)'
                          : el.align === 'right'
                            ? 'translate(-100%, -0.85em)'
                            : 'translate(0, -0.85em)',
                      color: el.color,
                      fontWeight: el.bold ? 700 : 400,
                      fontSize: `${fontSizePtToPreviewPx(el.fontSize, stageHeightPx)}px`,
                      textAlign: el.align,
                      width: el.maxWidthPct > 0 ? `${el.maxWidthPct}%` : undefined,
                      textTransform: el.uppercase ? 'uppercase' : undefined,
                      borderBottom: el.underline ? `1.5px solid ${el.color}` : undefined,
                      paddingBottom: el.underline ? 2 : 0,
                      whiteSpace: el.maxWidthPct > 0 ? 'normal' : 'nowrap',
                      lineHeight: 1.15,
                      fontFamily: 'Nunito, Helvetica, Arial, sans-serif',
                      zIndex: isSelected ? 20 : 1,
                    }}
                  >
                    {el.text || '—'}
                  </div>
                )
              })}
          </div>

          <p className="text-xs text-slate-500 mt-3">
            Ctrl/Cmd+clique seleciona vários · Setas movem (Shift = passo maior) · Delete remove ·
            Ctrl+Z desfaz · use “Centralizar no documento” no painel à direita.
            {meta ? (
              <>
                {' '}
                Curso: <strong>{meta.courseName}</strong> · Instituição:{' '}
                <strong>{meta.institutionName}</strong>.
              </>
            ) : null}
          </p>
        </section>

        {/* Propriedades */}
        <aside className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-4">
          <h2 className="text-sm font-semibold text-secondary">Propriedades</h2>

          {selectedCount === 0 ? (
            <p className="text-sm text-slate-500">Selecione um elemento na visualização ou na lista.</p>
          ) : selectedCount > 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-700">
                <strong>{selectedCount}</strong> elementos selecionados.
              </p>
              <ul className="text-xs text-slate-500 space-y-1">
                {selectedElements.map((el) => (
                  <li key={el.id}>
                    • {el.label}{' '}
                    <span className="text-slate-400">
                      ({isImageElement(el) ? 'imagem' : `${el.fontSize} pt`})
                    </span>
                  </li>
                ))}
              </ul>

              {selectedTextElements.length > 0 && (
                <>
                  <Input
                    label="Tamanho da fonte (pt) — textos"
                    type="number"
                    min={4}
                    max={72}
                    placeholder={multiFontSize == null ? 'valores mistos' : undefined}
                    value={multiFontSize != null ? String(multiFontSize) : ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                      const n = Number(e.target.value)
                      if (!Number.isFinite(n) || n < 4 || n > 72) return
                      updateElements(
                        selectedTextElements.map((el) => el.id),
                        { fontSize: n }
                      )
                    }}
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        updateElements(
                          selectedTextElements.map((el) => el.id),
                          (el) => ({ fontSize: Math.max(4, el.fontSize - 1) })
                        )
                      }
                    >
                      −1 pt
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={() =>
                        updateElements(
                          selectedTextElements.map((el) => el.id),
                          (el) => ({ fontSize: Math.min(72, el.fontSize + 1) })
                        )
                      }
                    >
                      +1 pt
                    </Button>
                  </div>
                </>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={alignSelectionToDocumentCenter}
              >
                Centralizar no documento
              </Button>
              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                onClick={removeSelectedElements}
              >
                Remover selecionados
              </Button>
            </div>
          ) : selected && isImageElement(selected) ? (
            <>
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">{selected.label}</div>
                <p className="text-xs text-slate-500 mb-2">Elemento de imagem</p>
                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 flex items-center justify-center min-h-[96px]">
                  {elementPreviewSrc(selected, meta?.logoUrl) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={elementPreviewSrc(selected, meta?.logoUrl) || ''}
                      alt={selected.label}
                      className="max-h-24 max-w-full object-contain"
                    />
                  ) : (
                    <span className="text-xs text-slate-500">Sem imagem</span>
                  )}
                </div>
              </div>

              <Input
                label="Nome do elemento"
                value={selected.label}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateElement(selected.id, { label: e.target.value })
                }
              />

              <input
                ref={imageFileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                className="hidden"
                onChange={(e) => void handleElementImageUpload(e.target.files?.[0] ?? null)}
              />
              <div className="flex flex-col gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  loading={uploadingImage}
                  onClick={() => imageFileRef.current?.click()}
                >
                  Enviar imagem
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => updateElement(selected.id, { imageUrl: PLATFORM_LOGO_TOKEN })}
                >
                  Usar logo da plataforma
                </Button>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={alignSelectionToDocumentCenter}
              >
                Centralizar no documento
              </Button>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="X (%)"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={String(Number(selected.x.toFixed(1)))}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateElement(selected.id, { x: Number(e.target.value) || 0 })
                  }
                />
                <Input
                  label="Y (%)"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={String(Number(selected.y.toFixed(1)))}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateElement(selected.id, { y: Number(e.target.value) || 0 })
                  }
                />
                <Input
                  label="Largura (%)"
                  type="number"
                  min={1}
                  max={100}
                  step={0.1}
                  value={String(Number(selected.widthPct.toFixed(1)))}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateElement(selected.id, {
                      widthPct: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
                <Input
                  label="Altura (%)"
                  type="number"
                  min={1}
                  max={100}
                  step={0.1}
                  value={String(Number(selected.heightPct.toFixed(1)))}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateElement(selected.id, {
                      heightPct: Math.max(1, Number(e.target.value) || 1),
                    })
                  }
                />
              </div>

              <Input
                label="Opacidade (0–1)"
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={String(Number(selected.opacity.toFixed(2)))}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateElement(selected.id, {
                    opacity: Math.min(1, Math.max(0, Number(e.target.value) || 0)),
                  })
                }
              />

              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.visible}
                    onChange={(e) => updateElement(selected.id, { visible: e.target.checked })}
                  />
                  Visível no certificado
                </label>
              </div>

              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                onClick={removeSelectedElements}
              >
                Remover elemento
              </Button>
            </>
          ) : selected ? (
            <>
              <div>
                <Input
                  label="Nome do elemento"
                  value={selected.label}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateElement(selected.id, { label: e.target.value })
                  }
                />
              </div>
              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Conteúdo</div>
                <textarea
                  className="w-full border border-border rounded-lg p-2 text-sm min-h-[96px] focus:outline-none focus:ring-2 focus:ring-primary"
                  value={selected.text}
                  onFocus={() => pushHistory()}
                  onChange={(e) =>
                    updateElement(selected.id, { text: e.target.value }, { recordHistory: false })
                  }
                />
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={alignSelectionToDocumentCenter}
              >
                Centralizar no documento
              </Button>

              <div>
                <div className="text-xs font-medium text-slate-500 mb-1">Inserir variável no texto</div>
                <div className="flex flex-wrap gap-1.5">
                  {editableVariables.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      title={v.value || v.key}
                      onClick={() => insertPlaceholder(v.key)}
                      className="text-[11px] px-2 py-1 rounded border border-slate-200 bg-slate-50 hover:bg-sky-50 hover:border-primary font-mono"
                    >
                      {v.key}
                    </button>
                  ))}
                  {READONLY_CERTIFICATE_PLACEHOLDERS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      title={p.description}
                      onClick={() => insertPlaceholder(p.key)}
                      className="text-[11px] px-2 py-1 rounded border border-dashed border-slate-200 bg-white hover:bg-sky-50 hover:border-primary font-mono text-slate-600"
                    >
                      {p.key}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Input
                  label="X (%)"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={String(Number(selected.x.toFixed(1)))}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateElement(selected.id, { x: Number(e.target.value) || 0 })
                  }
                />
                <Input
                  label="Y (%)"
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={String(Number(selected.y.toFixed(1)))}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                    updateElement(selected.id, { y: Number(e.target.value) || 0 })
                  }
                />
              </div>

              <Input
                label="Tamanho (pt — igual ao PDF)"
                type="number"
                min={4}
                max={72}
                value={String(selected.fontSize)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateElement(selected.id, { fontSize: Number(e.target.value) || 12 })
                }
              />

              <Input
                label="Largura máx. (%)"
                type="number"
                min={0}
                max={100}
                value={String(selected.maxWidthPct)}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateElement(selected.id, { maxWidthPct: Number(e.target.value) || 0 })
                }
              />

              <div>
                <label className="block text-sm font-medium mb-1">Alinhamento do texto</label>
                <select
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm"
                  value={selected.align}
                  onChange={(e) =>
                    updateElement(selected.id, {
                      align: e.target.value as CertificateLayoutElement['align'],
                    })
                  }
                >
                  <option value="left">Esquerda</option>
                  <option value="center">Centro</option>
                  <option value="right">Direita</option>
                </select>
              </div>

              <Input
                label="Cor"
                type="color"
                value={selected.color}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  updateElement(selected.id, { color: e.target.value })
                }
              />

              <div className="space-y-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.bold}
                    onChange={(e) => updateElement(selected.id, { bold: e.target.checked })}
                  />
                  Negrito
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected.uppercase)}
                    onChange={(e) => updateElement(selected.id, { uppercase: e.target.checked })}
                  />
                  Maiúsculas
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(selected.underline)}
                    onChange={(e) => updateElement(selected.id, { underline: e.target.checked })}
                  />
                  Sublinhado
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.visible}
                    onChange={(e) => updateElement(selected.id, { visible: e.target.checked })}
                  />
                  Visível no certificado
                </label>
              </div>

              <Button
                variant="outline"
                className="w-full text-red-600 border-red-200 hover:bg-red-50"
                onClick={removeSelectedElements}
              >
                Remover elemento
              </Button>
            </>
          ) : null}
        </aside>
      </div>

        {/* Variáveis do certificado */}
        <aside className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-secondary">Variáveis do certificado</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Adicione, remova ou renomeie chaves. Valores salvam automaticamente. Ao renomear,
                os textos do modelo são atualizados — salve o modelo em seguida.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={addEditableVariable}>
              + Variável
            </Button>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Editáveis nesta página
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-3 py-2 font-medium w-[32%]">Chave</th>
                    <th className="px-3 py-2 font-medium">Valor</th>
                    <th className="px-3 py-2 font-medium w-16 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {editableVariables.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-3 py-4 text-sm text-slate-500 text-center">
                        Nenhuma variável editável. Clique em “+ Variável” para criar.
                      </td>
                    </tr>
                  ) : (
                    editableVariables.map((v) => (
                      <tr key={v.id} className="border-t border-slate-100">
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="text"
                            defaultValue={v.key}
                            key={`${v.id}:${v.key}:${keyInputEpoch}`}
                            onBlur={(e) => commitVariableKey(v.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                ;(e.target as HTMLInputElement).blur()
                              }
                            }}
                            className="w-full border border-border rounded-md px-2.5 py-1.5 text-sm font-mono text-primary focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label="Chave da variável"
                            spellCheck={false}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <input
                            type="text"
                            value={v.value}
                            onChange={(e) => updateVariableValue(v.id, e.target.value)}
                            className="w-full border border-border rounded-md px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                            aria-label={`Valor de ${v.key}`}
                          />
                        </td>
                        <td className="px-3 py-2 align-middle text-right">
                          <button
                            type="button"
                            onClick={() => removeEditableVariable(v.id)}
                            className="text-xs text-red-600 hover:text-red-700 hover:underline"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Disponíveis (somente informativo)
            </h3>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left text-xs text-slate-500">
                    <th className="px-3 py-2 font-medium w-[32%]">Chave</th>
                    <th className="px-3 py-2 font-medium">Origem</th>
                  </tr>
                </thead>
                <tbody>
                  {READONLY_CERTIFICATE_PLACEHOLDERS.map((p) => (
                    <tr key={p.key} className="border-t border-slate-100">
                      <td className="px-3 py-2 align-top">
                        <code className="text-xs font-mono text-slate-600">{p.key}</code>
                        <div className="text-[11px] text-slate-400 mt-0.5">{p.label}</div>
                      </td>
                      <td className="px-3 py-2 align-top text-slate-500 text-xs leading-relaxed">
                        {p.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </aside>

        {/* Lista de elementos */}
        <aside className="bg-white rounded-lg border border-slate-200 shadow-sm p-3 space-y-2">
          <div className="flex flex-wrap items-end justify-between gap-2 px-1">
            <div>
              <h2 className="text-sm font-semibold text-secondary">Elementos</h2>
              <p className="text-xs text-slate-500">
                Clique para selecionar · Ctrl/Cmd+clique para vários · Setas movem · Delete remove
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={addTextElement}>
                + Texto
              </Button>
              <Button size="sm" variant="outline" onClick={addImageElement}>
                + Imagem
              </Button>
            </div>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
            {layout.elements.map((el) => {
              const isSelected = selectedIds.includes(el.id)
              const kind = isImageElement(el) ? 'imagem' : 'texto'
              const summary = isImageElement(el)
                ? el.imageUrl === PLATFORM_LOGO_TOKEN || !el.imageUrl
                  ? 'logo da plataforma'
                  : 'imagem personalizada'
                : el.text || '(vazio)'
              return (
                <li key={el.id}>
                  <button
                    type="button"
                    onClick={(e) => selectElement(el.id, e.ctrlKey || e.metaKey || e.shiftKey)}
                    className={`w-full text-left px-3 py-2 rounded-md text-sm border transition-colors ${
                      isSelected
                        ? 'border-primary bg-sky-50 text-secondary'
                        : 'border-slate-100 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="font-medium flex items-center gap-2 truncate">
                      {isSelected && selectedCount > 1 && (
                        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-primary text-[10px] text-white px-1 shrink-0">
                          {selectedIds.indexOf(el.id) + 1}
                        </span>
                      )}
                      <span className="truncate">{el.label}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-slate-400 shrink-0">
                        {kind}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {el.visible ? summary : 'oculto'}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>
      </div>
    </div>
  )
}
