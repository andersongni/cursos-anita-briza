'use client'

import { useCallback, useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import Link from 'next/link'
import { formatDate } from '@/lib/utils'
import toast from 'react-hot-toast'

type Student = {
  id: string
  full_name: string
  username: string
  status: string
  deleted_at: string | null
  created_at: string
}

type ConfirmType = 'APPROVE' | 'BLOCK' | 'DELETE' | 'RESTORE' | ''

export default function AdminAlunosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Ativos')
  const [loading, setLoading] = useState(true)
  const [alunos, setAlunos] = useState<Student[]>([])
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: '' as ConfirmType,
    studentId: '',
    studentName: '',
  })

  const load = useCallback(async () => {
    try {
      const deletedParam =
        statusFilter === 'Excluídos' ? 'only' : statusFilter === 'Todos' ? 'include' : undefined
      const url = deletedParam
        ? `/api/admin/students?deleted=${deletedParam}`
        : '/api/admin/students'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Falha ao carregar alunos')
      const data = await res.json()
      setAlunos(data.profiles ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar alunos')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    void load()
  }, [load])

  const filteredAlunos = alunos.filter((a) => {
    const matchesSearch =
      a.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.username.toLowerCase().includes(searchTerm.toLowerCase())
    const isDeleted = a.deleted_at != null

    if (statusFilter === 'Excluídos') {
      return matchesSearch && isDeleted
    }
    if (statusFilter === 'Todos') {
      return matchesSearch
    }
    if (statusFilter === 'Ativos') {
      return matchesSearch && !isDeleted
    }
    if (statusFilter === 'Pendentes') {
      return matchesSearch && !isDeleted && a.status === 'PENDING'
    }
    if (statusFilter === 'Aprovados') {
      return matchesSearch && !isDeleted && a.status === 'APPROVED'
    }
    if (statusFilter === 'Bloqueados') {
      return matchesSearch && !isDeleted && a.status === 'BLOCKED'
    }
    return matchesSearch
  })

  const getStatusBadge = (aluno: Student) => {
    if (aluno.deleted_at) {
      return <Badge variant="outline">Excluído</Badge>
    }
    switch (aluno.status) {
      case 'PENDING':
        return <Badge variant="warning">Pendente</Badge>
      case 'APPROVED':
        return <Badge variant="success">Aprovado</Badge>
      case 'BLOCKED':
        return <Badge variant="error">Bloqueado</Badge>
      default:
        return <Badge>Desconhecido</Badge>
    }
  }

  const openConfirm = (studentId: string, type: ConfirmType, studentName: string) => {
    setConfirmModal({ isOpen: true, type, studentId, studentName })
  }

  const confirmAction = async () => {
    const { type, studentId, studentName } = confirmModal
    try {
      let body: Record<string, string>
      if (type === 'DELETE') body = { id: studentId, action: 'DELETE' }
      else if (type === 'RESTORE') body = { id: studentId, action: 'RESTORE' }
      else if (type === 'APPROVE') body = { id: studentId, status: 'APPROVED' }
      else body = { id: studentId, status: 'BLOCKED' }

      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar aluno')

      const messages: Record<string, string> = {
        APPROVE: 'aprovado',
        BLOCK: 'bloqueado',
        DELETE: 'excluído',
        RESTORE: 'restaurado',
      }
      toast.success(`Aluno ${studentName} ${messages[type] ?? 'atualizado'} com sucesso!`)
      setConfirmModal({ isOpen: false, type: '', studentId: '', studentName: '' })
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar aluno')
    }
  }

  const modalTitle =
    confirmModal.type === 'APPROVE'
      ? 'Aprovar Aluno'
      : confirmModal.type === 'BLOCK'
        ? 'Bloquear Aluno'
        : confirmModal.type === 'DELETE'
          ? 'Excluir Aluno'
          : confirmModal.type === 'RESTORE'
            ? 'Restaurar Aluno'
            : ''

  const modalVerb =
    confirmModal.type === 'APPROVE'
      ? 'aprovar'
      : confirmModal.type === 'BLOCK'
        ? 'bloquear'
        : confirmModal.type === 'DELETE'
          ? 'excluir (o aluno poderá ser restaurado depois)'
          : confirmModal.type === 'RESTORE'
            ? 'restaurar'
            : ''

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-secondary">Gerenciar Alunos</h1>

      <div className="flex flex-col sm:flex-row gap-4 justify-between bg-white p-4 rounded-lg shadow-sm">
        <div className="flex-1 max-w-md">
          <Input
            placeholder="Buscar por nome ou usuário..."
            value={searchTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48">
          <Select
            options={[
              { value: 'Ativos', label: 'Ativos' },
              { value: 'Pendentes', label: 'Pendentes' },
              { value: 'Aprovados', label: 'Aprovados' },
              { value: 'Bloqueados', label: 'Bloqueados' },
              { value: 'Excluídos', label: 'Excluídos' },
              { value: 'Todos', label: 'Todos' },
            ]}
            value={statusFilter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatusFilter(e.target.value)}
          />
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
                <TableHead>Usuário</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de Cadastro</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredAlunos.map((aluno) => {
                const isDeleted = aluno.deleted_at != null
                return (
                  <TableRow key={aluno.id}>
                    <TableCell className="font-medium">{aluno.full_name}</TableCell>
                    <TableCell>{aluno.username}</TableCell>
                    <TableCell>{getStatusBadge(aluno)}</TableCell>
                    <TableCell>{formatDate(aluno.created_at)}</TableCell>
                    <TableCell className="text-right space-x-2">
                      {isDeleted ? (
                        <Button
                          size="sm"
                          variant="success"
                          onClick={() => openConfirm(aluno.id, 'RESTORE', aluno.full_name)}
                        >
                          Restaurar
                        </Button>
                      ) : (
                        <>
                          {aluno.status !== 'APPROVED' && (
                            <Button
                              size="sm"
                              variant="success"
                              onClick={() => openConfirm(aluno.id, 'APPROVE', aluno.full_name)}
                            >
                              Aprovar
                            </Button>
                          )}
                          {aluno.status !== 'BLOCKED' && (
                            <Button
                              size="sm"
                              variant="danger"
                              onClick={() => openConfirm(aluno.id, 'BLOCK', aluno.full_name)}
                            >
                              Bloquear
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openConfirm(aluno.id, 'DELETE', aluno.full_name)}
                          >
                            Excluir
                          </Button>
                        </>
                      )}
                      <Link href={`/admin/alunos/${aluno.id}`}>
                        <Button size="sm" variant="outline">
                          Detalhes
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                )
              })}
              {filteredAlunos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                    Nenhum aluno encontrado.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <Modal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ ...confirmModal, isOpen: false })}
        title={modalTitle}
      >
        <div className="space-y-4">
          <p>
            Tem certeza que deseja {modalVerb} o aluno{' '}
            <strong>{confirmModal.studentName}</strong>?
          </p>
          {confirmModal.type === 'DELETE' && (
            <p className="text-sm text-gray-500">
              A exclusão é lógica: o aluno sai das métricas e não consegue mais entrar, mas o
              histórico permanece e pode ser restaurado depois.
            </p>
          )}
          <div className="flex justify-end space-x-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Cancelar
            </Button>
            <Button
              variant={
                confirmModal.type === 'APPROVE' || confirmModal.type === 'RESTORE'
                  ? 'success'
                  : 'danger'
              }
              onClick={() => void confirmAction()}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
