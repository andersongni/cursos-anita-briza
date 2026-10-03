'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
  weight: number
  target_percentage: number
  active: boolean
  _count?: { questions: number }
  activeQuestions?: number
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500']

export default function AdminDimensoesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [dimensoes, setDimensoes] = useState<Dimension[]>([])
  const [pctDrafts, setPctDrafts] = useState<Record<string, string>>({})
  const [form, setForm] = useState({
    name: '',
    description: '',
    weight: '1',
    target_percentage: '10',
  })

  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const savedLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        activeQuestions: questions.filter(
          (q: { dimension_id: string; active: boolean }) =>
            q.dimension_id === d.id && q.active
        ).length,
      }))
      setDimensoes(dims)
      const drafts: Record<string, string> = {}
      for (const d of dims) {
        drafts[d.id] = String(d.target_percentage ?? 0)
      }
      setPctDrafts(drafts)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Erro ao carregar temas'
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
    const timers = debounceTimers.current
    return () => {
      Object.values(timers).forEach(clearTimeout)
      if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
    }
  }, [load])

  const totalPct = dimensoes
    .filter((d) => d.active)
    .reduce((s, d) => s + (d.target_percentage || 0), 0)

  const persistPercentage = useCallback(async (id: string, raw: string) => {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      toast.error('Percentual deve ser entre 0 e 100')
      setSaveStatus('error')
      return
    }

    setSaveStatus('saving')
    try {
      const res = await fetch('/api/admin/dimensions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, target_percentage: n }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar percentual')

      setDimensoes((prev) =>
        prev.map((d) => (d.id === id ? { ...d, target_percentage: n } : d))
      )
      setPctDrafts((prev) => ({ ...prev, [id]: String(n) }))
      setSaveStatus('saved')
      if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
      savedLabelTimer.current = setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (e: unknown) {
      setSaveStatus('error')
      const message = e instanceof Error ? e.message : 'Erro ao salvar percentual'
      toast.error(message)
    }
  }, [])

  const handlePercentageChange = (id: string, value: string) => {
    setPctDrafts((prev) => ({ ...prev, [id]: value }))
    const n = Number(value)
    if (Number.isFinite(n)) {
      setDimensoes((prev) =>
        prev.map((d) => (d.id === id ? { ...d, target_percentage: n } : d))
      )
    }

    if (debounceTimers.current[id]) clearTimeout(debounceTimers.current[id])
    debounceTimers.current[id] = setTimeout(() => {
      void persistPercentage(id, value)
    }, 500)
  }

  const toggleActive = async (d: Dimension) => {
    setSaveStatus('saving')
    try {
      const res = await fetch('/api/admin/dimensions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: d.id, active: !d.active }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar status')
      setDimensoes((prev) =>
        prev.map((row) => (row.id === d.id ? { ...row, active: !d.active } : row))
      )
      setSaveStatus('saved')
      if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
      savedLabelTimer.current = setTimeout(() => setSaveStatus('idle'), 1500)
    } catch (e: unknown) {
      setSaveStatus('error')
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar status')
    }
  }

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do tema')
      return
    }
    const pct = Number(form.target_percentage)
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
      toast.error('Percentual deve ser entre 0 e 100')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/admin/dimensions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          weight: Number(form.weight) || 1,
          target_percentage: pct,
          display_order: dimensoes.length,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao criar tema')
      toast.success('Tema criado')
      setModalOpen(false)
      setForm({ name: '', description: '', weight: '1', target_percentage: '10' })
      setLoading(true)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao criar tema')
    } finally {
      setSaving(false)
    }
  }

  const statusLabel =
    saveStatus === 'saving'
      ? 'Salvando…'
      : saveStatus === 'saved'
        ? 'Salvo'
        : saveStatus === 'error'
          ? 'Erro ao salvar'
          : 'Edite o % de cada tema — salva automaticamente'

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-end gap-3">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Dimensões / Temas</h1>
          <p
            className={`text-sm mt-1 ${
              saveStatus === 'error'
                ? 'text-red-600'
                : saveStatus === 'saving'
                  ? 'text-amber-600'
                  : saveStatus === 'saved'
                    ? 'text-green-600'
                    : 'text-slate-500'
            }`}
          >
            {statusLabel}
          </p>
        </div>
        <Button variant="primary" onClick={() => setModalOpen(true)}>
          Novo Tema
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <div className="md:col-span-2 bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <h3 className="font-semibold mb-2">Distribuição alvo</h3>
          {dimensoes.filter((d) => d.active).length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum tema cadastrado ainda.</p>
          ) : (
            <>
              <div className="flex h-6 rounded-full overflow-hidden w-full bg-gray-200">
                {dimensoes
                  .filter((d) => d.active && d.target_percentage > 0)
                  .map((d, i) => (
                    <div
                      key={d.id}
                      className={COLORS[i % COLORS.length]}
                      style={{ width: `${Math.min(100, Math.max(0, d.target_percentage))}%` }}
                      title={`${d.name}: ${d.target_percentage}%`}
                    />
                  ))}
              </div>
              <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-600">
                {dimensoes
                  .filter((d) => d.active)
                  .map((d, i) => (
                    <span key={d.id} className="flex items-center">
                      <div
                        className={`w-3 h-3 ${COLORS[i % COLORS.length]} rounded-full mr-1`}
                      />
                      {d.name} ({d.target_percentage}%)
                    </span>
                  ))}
              </div>
            </>
          )}
        </div>
        <div
          className={`p-4 rounded-lg shadow-sm border flex flex-col justify-center ${
            Math.abs(totalPct - 100) < 0.01 || dimensoes.filter((d) => d.active).length === 0
              ? 'bg-blue-50 border-blue-100'
              : 'bg-yellow-50 border-yellow-100'
          }`}
        >
          <h3 className="font-semibold mb-1">Total: {totalPct.toFixed(1)}%</h3>
          <p className="text-sm text-gray-600">
            {dimensoes.filter((d) => d.active).length === 0
              ? 'Cadastre temas para montar a distribuição das provas.'
              : Math.abs(totalPct - 100) < 0.01
                ? 'A distribuição soma 100%.'
                : 'Ajuste os percentuais para somar 100%.'}
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
              </TableRow>
            </TableHeader>
            <TableBody>
              {dimensoes.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="font-medium">{d.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {d.description || '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 max-w-[7rem]">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        aria-label={`Percentual de aplicação de ${d.name}`}
                        className="w-full px-2 py-1.5 border border-border rounded-lg text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                        value={pctDrafts[d.id] ?? String(d.target_percentage)}
                        onChange={(e) => handlePercentageChange(d.id, e.target.value)}
                        onBlur={(e) => {
                          if (debounceTimers.current[d.id]) {
                            clearTimeout(debounceTimers.current[d.id])
                          }
                          void persistPercentage(d.id, e.target.value)
                        }}
                      />
                      <span className="text-sm text-slate-500">%</span>
                    </div>
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
                </TableRow>
              ))}
              {dimensoes.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                    Nenhum tema cadastrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title="Novo Tema">
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
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Peso (1-3)"
              type="number"
              min="1"
              max="3"
              value={form.weight}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, weight: e.target.value }))
              }
            />
            <Input
              label="Percentual de aplicação (%)"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={form.target_percentage}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, target_percentage: e.target.value }))
              }
            />
          </div>
          <div className="flex justify-end space-x-2 mt-4">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>
              Cancelar
            </Button>
            <Button variant="primary" loading={saving} onClick={handleCreate}>
              Salvar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
