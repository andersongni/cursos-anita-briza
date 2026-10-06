'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { useAdminCourse } from '@/components/courses/AdminCourseProvider'

type Course = {
  id: string
  slug: string
  name: string
  description: string | null
  hours: number
  active: boolean
  assessment?: {
    questionCount: number
    timeLimitMinutes: number
    passingScore: number
    mcWeightPercent?: number
    discursiveWeightPercent?: number
    discursiveCount?: number
  }
}

type ConfirmType = 'DELETE' | 'RESTORE' | ''

const DEFAULT_FORM = {
  name: '',
  description: '',
  hours: '40',
  questionCount: '40',
  discursiveCount: '2',
  mcWeightPercent: '80',
  discursiveWeightPercent: '20',
  timeLimitMinutes: '120',
  passingScore: '70',
}

export default function AdminCursosPage() {
  const { reload: reloadActiveCourse } = useAdminCourse()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [statusFilter, setStatusFilter] = useState('Ativos')
  const [searchTerm, setSearchTerm] = useState('')
  const [courses, setCourses] = useState<Course[]>([])
  const [createOpen, setCreateOpen] = useState(false)
  const [editing, setEditing] = useState<Course | null>(null)
  const [form, setForm] = useState(DEFAULT_FORM)
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: '' as ConfirmType,
    courseId: '',
    courseName: '',
  })

  const emptyForm = () => setForm(DEFAULT_FORM)

  const openEdit = (course: Course) => {
    setEditing(course)
    setForm({
      name: course.name,
      description: course.description ?? '',
      hours: String(course.hours),
      questionCount: String(course.assessment?.questionCount ?? 40),
      discursiveCount: String(course.assessment?.discursiveCount ?? 2),
      mcWeightPercent: String(course.assessment?.mcWeightPercent ?? 80),
      discursiveWeightPercent: String(
        course.assessment?.discursiveWeightPercent ?? 20
      ),
      timeLimitMinutes: String(course.assessment?.timeLimitMinutes ?? 120),
      passingScore: String(course.assessment?.passingScore ?? 70),
    })
  }

  const closeEdit = () => {
    setEditing(null)
    emptyForm()
  }

  const load = useCallback(async () => {
    try {
      const deletedParam =
        statusFilter === 'Excluídos'
          ? 'only'
          : statusFilter === 'Todos'
            ? 'include'
            : undefined
      const url = deletedParam
        ? `/api/admin/courses?manage=1&deleted=${deletedParam}`
        : '/api/admin/courses?manage=1'
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar cursos')
      const data = await res.json()
      setCourses(data.courses ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar cursos')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const filtered = courses.filter((c) => {
    const q = searchTerm.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      c.slug.toLowerCase().includes(q) ||
      (c.description ?? '').toLowerCase().includes(q)
    )
  })

  const openConfirm = (courseId: string, type: ConfirmType, courseName: string) => {
    setConfirmModal({ isOpen: true, type, courseId, courseName })
  }

  const confirmAction = async () => {
    const { type, courseId, courseName } = confirmModal
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: courseId, action: type }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar curso')

      toast.success(
        type === 'DELETE'
          ? `Curso "${courseName}" excluído (pode ser restaurado).`
          : `Curso "${courseName}" restaurado.`
      )
      setConfirmModal({ isOpen: false, type: '', courseId: '', courseName: '' })
      await load()
      await reloadActiveCourse()
      if (type === 'DELETE') {
        // Garante que o seletor de curso do topo reflita a exclusão
        window.location.reload()
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar curso')
    }
  }

  const createCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          description: form.description,
          hours: Number(form.hours) || 40,
          questionCount: Number(form.questionCount),
          discursiveCount: Number(form.discursiveCount),
          mcWeightPercent: Number(form.mcWeightPercent),
          discursiveWeightPercent: Number(form.discursiveWeightPercent),
          timeLimitMinutes: Number(form.timeLimitMinutes),
          passingScore: Number(form.passingScore),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao criar curso')
      toast.success('Curso criado com sucesso!')
      setCreateOpen(false)
      emptyForm()
      await load()
      await reloadActiveCourse()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao criar curso')
    } finally {
      setSaving(false)
    }
  }

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    setSaving(true)
    try {
      const res = await fetch('/api/admin/courses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editing.id,
          name: form.name,
          description: form.description,
          hours: Number(form.hours) || 40,
          questionCount: Number(form.questionCount),
          discursiveCount: Number(form.discursiveCount),
          mcWeightPercent: Number(form.mcWeightPercent),
          discursiveWeightPercent: Number(form.discursiveWeightPercent),
          timeLimitMinutes: Number(form.timeLimitMinutes),
          passingScore: Number(form.passingScore),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar curso')
      toast.success('Curso atualizado.')
      closeEdit()
      await load()
      await reloadActiveCourse()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar curso')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Cursos</h1>
          <p className="text-slate-500 mt-1">
            Crie, edite e exclua logicamente (como alunos). Excluídos somem do seletor e das
            matrículas novas, mas podem ser restaurados.
          </p>
        </div>
        <Button
          variant="primary"
          onClick={() => {
            emptyForm()
            setCreateOpen(true)
          }}
        >
          Novo curso
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white p-4 rounded-lg shadow-sm">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nome..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setSearchTerm(e.target.value)
            }
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
              setStatusFilter(e.target.value)
            }
            options={[
              { value: 'Ativos', label: 'Ativos' },
              { value: 'Excluídos', label: 'Excluídos' },
              { value: 'Todos', label: 'Todos' },
            ]}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Identificador</TableHead>
                <TableHead>Carga (h)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                    Nenhum curso encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((course) => (
                  <TableRow key={course.id}>
                    <TableCell>
                      <div className="font-medium text-secondary">{course.name}</div>
                      {course.description ? (
                        <div className="text-xs text-slate-500 mt-0.5 line-clamp-2">
                          {course.description}
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 font-mono">
                      {course.slug}
                    </TableCell>
                    <TableCell>{course.hours}</TableCell>
                    <TableCell>
                      {course.active ? (
                        <Badge variant="success">Ativo</Badge>
                      ) : (
                        <Badge variant="outline">Excluído</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex flex-wrap justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEdit(course)}
                        >
                          Editar
                        </Button>
                        {course.active ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              openConfirm(course.id, 'DELETE', course.name)
                            }
                          >
                            Excluir
                          </Button>
                        ) : (
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() =>
                              openConfirm(course.id, 'RESTORE', course.name)
                            }
                          >
                            Restaurar
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      <Modal
        isOpen={createOpen}
        onClose={() => {
          setCreateOpen(false)
          emptyForm()
        }}
        title="Novo curso"
      >
        <form onSubmit={createCourse} className="space-y-4">
          <Input
            label="Nome *"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
            placeholder="Ex.: Mecânica Básica"
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Resumo do curso para alunos e certificados"
            />
          </div>
          <Input
            label="Carga horária (horas)"
            type="number"
            min={1}
            value={form.hours}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, hours: e.target.value }))
            }
          />
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <p className="text-sm font-medium text-slate-800">
              Configurações da avaliação
            </p>
            <Input
              label="Perguntas de múltipla escolha *"
              type="number"
              min={1}
              max={200}
              value={form.questionCount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, questionCount: e.target.value }))
              }
              required
            />
            <Input
              label="Perguntas discursivas *"
              type="number"
              min={0}
              max={50}
              value={form.discursiveCount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, discursiveCount: e.target.value }))
              }
              required
            />
            <Input
              label="Peso múltipla escolha (%) *"
              type="number"
              min={0}
              max={100}
              value={form.mcWeightPercent}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const mc = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                setForm((f) => ({
                  ...f,
                  mcWeightPercent: String(mc),
                  discursiveWeightPercent: String(100 - mc),
                }))
              }}
              required
            />
            <Input
              label="Peso discursivas (%) *"
              type="number"
              min={0}
              max={100}
              value={form.discursiveWeightPercent}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const d = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                setForm((f) => ({
                  ...f,
                  discursiveWeightPercent: String(d),
                  mcWeightPercent: String(100 - d),
                }))
              }}
              required
            />
            <Input
              label="Tempo limite (minutos) *"
              type="number"
              min={1}
              max={600}
              value={form.timeLimitMinutes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, timeLimitMinutes: e.target.value }))
              }
              required
            />
            <Input
              label="Nota mínima para aprovação (%) *"
              type="number"
              min={0}
              max={100}
              value={form.passingScore}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, passingScore: e.target.value }))
              }
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCreateOpen(false)
                emptyForm()
              }}
            >
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Criar curso
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={editing != null}
        onClose={closeEdit}
        title="Editar curso"
      >
        <form onSubmit={saveEdit} className="space-y-4">
          {editing ? (
            <p className="text-xs text-slate-500 font-mono">
              Identificador: {editing.slug}
            </p>
          ) : null}
          <Input
            label="Nome *"
            value={form.name}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, name: e.target.value }))
            }
            required
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <textarea
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[80px]"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
              placeholder="Resumo do curso para alunos e certificados"
            />
          </div>
          <Input
            label="Carga horária (horas)"
            type="number"
            min={1}
            value={form.hours}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setForm((f) => ({ ...f, hours: e.target.value }))
            }
          />
          <div className="border-t border-slate-200 pt-4 space-y-4">
            <p className="text-sm font-medium text-slate-800">
              Configurações da avaliação
            </p>
            <Input
              label="Perguntas de múltipla escolha *"
              type="number"
              min={1}
              max={200}
              value={form.questionCount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, questionCount: e.target.value }))
              }
              required
            />
            <Input
              label="Perguntas discursivas *"
              type="number"
              min={0}
              max={50}
              value={form.discursiveCount}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, discursiveCount: e.target.value }))
              }
              required
            />
            <Input
              label="Peso múltipla escolha (%) *"
              type="number"
              min={0}
              max={100}
              value={form.mcWeightPercent}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const mc = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                setForm((f) => ({
                  ...f,
                  mcWeightPercent: String(mc),
                  discursiveWeightPercent: String(100 - mc),
                }))
              }}
              required
            />
            <Input
              label="Peso discursivas (%) *"
              type="number"
              min={0}
              max={100}
              value={form.discursiveWeightPercent}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                const d = Math.max(0, Math.min(100, Number(e.target.value) || 0))
                setForm((f) => ({
                  ...f,
                  discursiveWeightPercent: String(d),
                  mcWeightPercent: String(100 - d),
                }))
              }}
              required
            />
            <Input
              label="Tempo limite (minutos) *"
              type="number"
              min={1}
              max={600}
              value={form.timeLimitMinutes}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, timeLimitMinutes: e.target.value }))
              }
              required
            />
            <Input
              label="Nota mínima para aprovação (%) *"
              type="number"
              min={0}
              max={100}
              value={form.passingScore}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setForm((f) => ({ ...f, passingScore: e.target.value }))
              }
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={closeEdit}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" loading={saving}>
              Salvar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() =>
          setConfirmModal({ isOpen: false, type: '', courseId: '', courseName: '' })
        }
        title={
          confirmModal.type === 'DELETE' ? 'Excluir curso' : 'Restaurar curso'
        }
      >
        <div className="space-y-4">
          <p className="text-slate-700">
            {confirmModal.type === 'DELETE' ? (
              <>
                Excluir logicamente o curso{' '}
                <strong>{confirmModal.courseName}</strong>? Ele deixa de aparecer
                para matrículas e no seletor, mas os dados são preservados e o curso
                pode ser restaurado depois.
              </>
            ) : (
              <>
                Restaurar o curso <strong>{confirmModal.courseName}</strong>?
              </>
            )}
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() =>
                setConfirmModal({
                  isOpen: false,
                  type: '',
                  courseId: '',
                  courseName: '',
                })
              }
            >
              Cancelar
            </Button>
            <Button
              variant={confirmModal.type === 'DELETE' ? 'danger' : 'primary'}
              onClick={() => void confirmAction()}
            >
              {confirmModal.type === 'DELETE' ? 'Excluir' : 'Restaurar'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
