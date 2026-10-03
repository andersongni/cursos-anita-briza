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
  created_at: string
}

export default function AdminAlunosPage() {
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('Todos')
  const [loading, setLoading] = useState(true)
  const [alunos, setAlunos] = useState<Student[]>([])
  const [confirmModal, setConfirmModal] = useState({
    isOpen: false,
    type: '',
    studentId: '',
    studentName: '',
  })

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/students')
      if (!res.ok) throw new Error('Falha ao carregar alunos')
      const data = await res.json()
      setAlunos(data.profiles ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar alunos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const filteredAlunos = alunos.filter((a) => {
    const matchesSearch =
      a.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      a.username.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus =
      statusFilter === 'Todos' ||
      (statusFilter === 'Pendentes' && a.status === 'PENDING') ||
      (statusFilter === 'Aprovados' && a.status === 'APPROVED') ||
      (statusFilter === 'Bloqueados' && a.status === 'BLOCKED')
    return matchesSearch && matchesStatus
  })

  const getStatusBadge = (status: string) => {
    switch (status) {
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

  const handleStatusChange = (studentId: string, type: string, studentName: string) => {
    setConfirmModal({ isOpen: true, type, studentId, studentName })
  }

  const confirmAction = async () => {
    const status = confirmModal.type === 'APPROVE' ? 'APPROVED' : 'BLOCKED'
    try {
      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: confirmModal.studentId, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar status')
      toast.success(
        `Aluno ${confirmModal.studentName} ${
          confirmModal.type === 'APPROVE' ? 'aprovado' : 'bloqueado'
        } com sucesso!`
      )
      setConfirmModal({ isOpen: false, type: '', studentId: '', studentName: '' })
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar status')
    }
  }

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
              { value: 'Todos', label: 'Todos' },
              { value: 'Pendentes', label: 'Pendentes' },
              { value: 'Aprovados', label: 'Aprovados' },
              { value: 'Bloqueados', label: 'Bloqueados' },
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
              {filteredAlunos.map((aluno) => (
                <TableRow key={aluno.id}>
                  <TableCell className="font-medium">{aluno.full_name}</TableCell>
                  <TableCell>{aluno.username}</TableCell>
                  <TableCell>{getStatusBadge(aluno.status)}</TableCell>
                  <TableCell>{formatDate(aluno.created_at)}</TableCell>
                  <TableCell className="text-right space-x-2">
                    {aluno.status !== 'APPROVED' && (
                      <Button
                        size="sm"
                        variant="success"
                        onClick={() =>
                          handleStatusChange(aluno.id, 'APPROVE', aluno.full_name)
                        }
                      >
                        Aprovar
                      </Button>
                    )}
                    {aluno.status !== 'BLOCKED' && (
                      <Button
                        size="sm"
                        variant="danger"
                        onClick={() => handleStatusChange(aluno.id, 'BLOCK', aluno.full_name)}
                      >
                        Bloquear
                      </Button>
                    )}
                    <Link href={`/admin/alunos/${aluno.id}`}>
                      <Button size="sm" variant="outline">
                        Detalhes
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
              {filteredAlunos.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-6 text-gray-500">
                    Nenhum aluno cadastrado.
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
        title={confirmModal.type === 'APPROVE' ? 'Aprovar Aluno' : 'Bloquear Aluno'}
      >
        <div className="space-y-4">
          <p>
            Tem certeza que deseja{' '}
            {confirmModal.type === 'APPROVE' ? 'aprovar' : 'bloquear'} o acesso do aluno{' '}
            <strong>{confirmModal.studentName}</strong>?
          </p>
          <div className="flex justify-end space-x-2">
            <Button
              variant="ghost"
              onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}
            >
              Cancelar
            </Button>
            <Button
              variant={confirmModal.type === 'APPROVE' ? 'success' : 'danger'}
              onClick={confirmAction}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
