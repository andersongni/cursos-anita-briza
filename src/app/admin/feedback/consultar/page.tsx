'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'

type FeedbackRow = {
  id: string
  subject: string | null
  message: string
  role: string
  created_at: string
  user: {
    id: string
    full_name: string
    username: string
    role: string
    deleted: boolean
  }
}

export default function AdminFeedbackConsultarPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([])

  const load = useCallback(async (q?: string) => {
    try {
      const url = q
        ? `/api/admin/feedback?q=${encodeURIComponent(q)}`
        : '/api/admin/feedback'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Falha ao carregar feedbacks')
      const data = await res.json()
      setFeedbacks(data.feedbacks ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar feedbacks')
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Consultar feedbacks</h1>
          <p className="text-gray-500 mt-1">
            Mensagens enviadas por alunos e administradores.
          </p>
        </div>
        <Link href="/admin/feedback">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        <Input
          placeholder="Buscar por aluno, assunto ou mensagem..."
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
        ) : feedbacks.length === 0 ? (
          <p className="p-8 text-center text-gray-500">Nenhum feedback registrado ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Autor</TableHead>
                <TableHead>Papel</TableHead>
                <TableHead>Assunto</TableHead>
                <TableHead>Mensagem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feedbacks.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="whitespace-nowrap text-sm">
                    {formatDateTime(f.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{f.user.full_name}</div>
                    <div className="text-xs text-gray-500">@{f.user.username}</div>
                    {f.user.deleted && (
                      <Badge variant="outline" className="mt-1">
                        Excluído
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant={f.role === 'ADMIN' ? 'info' : 'default'}>
                      {f.role === 'ADMIN' ? 'Admin' : 'Aluno'}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[10rem] truncate">{f.subject || '—'}</TableCell>
                  <TableCell className="max-w-md">
                    <p className="whitespace-pre-wrap text-sm text-slate-700">{f.message}</p>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
