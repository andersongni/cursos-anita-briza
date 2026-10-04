'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { ArrowLeft } from 'lucide-react'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import Badge from '@/components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/utils'

type Passage = {
  id: string
  title: string
  content: string
  active: boolean
  attempts: number
  created_at: string
  updated_at: string
}

const emptyForm = { title: '', content: '', active: true }

export default function AdminDigitacaoTextosPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seeding, setSeeding] = useState(false)
  const [search, setSearch] = useState('')
  const [passages, setPassages] = useState<Passage[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Passage | null>(null)
  const [form, setForm] = useState(emptyForm)

  const load = useCallback(async (q?: string) => {
    try {
      const url = q
        ? `/api/admin/typing-passages?q=${encodeURIComponent(q)}`
        : '/api/admin/typing-passages'
      const res = await fetch(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar textos')
      setPassages(data.passages ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar')
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

  const seedDefaults = async () => {
    setSeeding(true)
    try {
      const res = await fetch('/api/admin/typing-passages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'seed-defaults' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Falha ao carregar textos padrão')
      setPassages(data.passages ?? [])
      const seed = data.seed as
        | { created?: number; reactivated?: number; total?: number }
        | undefined
      toast.success(
        `Textos padrão ok: ${seed?.created ?? 0} criados, ${seed?.reactivated ?? 0} reativados (total ${seed?.total ?? passages.length}).`
      )
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar textos padrão')
    } finally {
      setSeeding(false)
    }
  }

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setModalOpen(true)
  }

  const openEdit = (passage: Passage) => {
    setEditing(passage)
    setForm({
      title: passage.title,
      content: passage.content,
      active: passage.active,
    })
    setModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch(
        editing ? `/api/admin/typing-passages/${editing.id}` : '/api/admin/typing-passages',
        {
          method: editing ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
        }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      toast.success(editing ? 'Texto atualizado' : 'Texto criado')
      setModalOpen(false)
      void load(search.trim() || undefined)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (passage: Passage) => {
    if (
      !window.confirm(
        passage.attempts > 0
          ? 'Este texto já tem tentativas. Ele será desativado (não apagado). Continuar?'
          : 'Excluir este texto permanentemente?'
      )
    ) {
      return
    }
    try {
      const res = await fetch(`/api/admin/typing-passages/${passage.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir')
      toast.success(data.deactivated ? 'Texto desativado' : 'Texto excluído')
      void load(search.trim() || undefined)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir')
    }
  }

  const toggleActive = async (passage: Passage) => {
    try {
      const res = await fetch(`/api/admin/typing-passages/${passage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !passage.active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar')
      toast.success(passage.active ? 'Texto desativado' : 'Texto ativado')
      void load(search.trim() || undefined)
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/exercicios/digitacao"
            className="inline-flex items-center text-sm text-accent hover:text-secondary mb-2"
          >
            <ArrowLeft className="w-4 h-4 mr-1" />
            Voltar à prática de digitação
          </Link>
          <h1 className="text-3xl font-bold text-secondary">Textos da digitação</h1>
          <p className="text-gray-500 mt-1">
            Cadastre e edite os textos usados na prática de digitação dos alunos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" loading={seeding} onClick={() => void seedDefaults()}>
            Carregar textos padrão
          </Button>
          <Button onClick={openCreate}>Novo texto</Button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        <Input
          placeholder="Buscar por título ou conteúdo..."
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
        ) : passages.length === 0 ? (
          <div className="p-8 text-center space-y-4">
            <p className="text-gray-500">Nenhum texto cadastrado neste banco.</p>
            <Button loading={seeding} onClick={() => void seedDefaults()}>
              Carregar textos padrão agora
            </Button>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Título</TableHead>
                <TableHead>Trecho</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tentativas</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {passages.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium text-secondary max-w-[12rem]">
                    {p.title}
                  </TableCell>
                  <TableCell className="text-slate-600 max-w-xs truncate">
                    {p.content.slice(0, 80)}
                    {p.content.length > 80 ? '…' : ''}
                  </TableCell>
                  <TableCell>
                    <Badge variant={p.active ? 'success' : 'default'}>
                      {p.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>{p.attempts}</TableCell>
                  <TableCell className="whitespace-nowrap text-slate-500">
                    {formatDateTime(p.updated_at)}
                  </TableCell>
                  <TableCell className="text-right space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>
                      Editar
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => void toggleActive(p)}>
                      {p.active ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => void handleDelete(p)}>
                      Excluir
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          if (!saving) setModalOpen(false)
        }}
        title={editing ? 'Editar texto' : 'Novo texto'}
        size="lg"
      >
        <div className="space-y-4">
          <Input
            label="Título"
            value={form.title}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, title: e.target.value }))
            }
            required
          />
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              Conteúdo (português)
              <span className="text-error ml-1">*</span>
            </label>
            <textarea
              className="w-full min-h-[180px] px-3 py-2 border border-border rounded-lg text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              required
            />
            <p className="mt-1 text-xs text-slate-500">
              Mínimo 40 caracteres · {form.content.trim().length} caracteres
            </p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Texto ativo (disponível para alunos)
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" disabled={saving} onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button loading={saving} onClick={() => void handleSave()}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
