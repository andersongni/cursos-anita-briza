'use client'

import { useCallback, useEffect, useState } from 'react'
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

const COLORS = ['bg-blue-500', 'bg-green-500', 'bg-yellow-500', 'bg-red-500', 'bg-purple-500', 'bg-pink-500']

export default function AdminDimensoesPage() {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dimensoes, setDimensoes] = useState<Dimension[]>([])
  const [form, setForm] = useState({
    name: '',
    description: '',
    weight: '1',
    target_percentage: '10',
  })

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
          (q: any) => q.dimension_id === d.id && q.active
        ).length,
      }))
      setDimensoes(dims)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar temas')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const totalPct = dimensoes
    .filter((d) => d.active)
    .reduce((s, d) => s + (d.target_percentage || 0), 0)

  const handleCreate = async () => {
    if (!form.name.trim()) {
      toast.error('Informe o nome do tema')
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
          target_percentage: Number(form.target_percentage) || 0,
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
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-secondary">Dimensões / Temas</h1>
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
                      style={{ width: `${d.target_percentage}%` }}
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
            Math.abs(totalPct - 100) < 0.01 || dimensoes.length === 0
              ? 'bg-blue-50 border-blue-100'
              : 'bg-yellow-50 border-yellow-100'
          }`}
        >
          <h3 className="font-semibold mb-1">Total: {totalPct.toFixed(0)}%</h3>
          <p className="text-sm text-gray-600">
            {dimensoes.length === 0
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
                <TableHead>Peso</TableHead>
                <TableHead>Alvo (%)</TableHead>
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
                  <TableCell>{d.weight}</TableCell>
                  <TableCell>{d.target_percentage}%</TableCell>
                  <TableCell>{d.activeQuestions ?? 0}</TableCell>
                  <TableCell>
                    <Badge variant={d.active ? 'success' : 'default'}>
                      {d.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
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
              label="Percentual Alvo (%)"
              type="number"
              min="0"
              max="100"
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
