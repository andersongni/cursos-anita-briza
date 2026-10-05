'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { downloadCertificatePdf, viewCertificatePdf } from '@/lib/certificate/open-pdf'

type CertificateRow = {
  id: string
  certificate_code: string
  course_name_snapshot: string
  completion_date: string
  score_snapshot: number | null
  created_at: string
  student: { id: string; full_name: string; username: string }
  course: { id: string; name: string } | null
}

type CourseOption = { id: string; name: string; active?: boolean }

export default function AdminCertificadosPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [courseFilter, setCourseFilter] = useState('all')
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [certificates, setCertificates] = useState<CertificateRow[]>([])

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const res = await fetch('/api/admin/courses?manage=1&deleted=include', {
          cache: 'no-store',
        })
        if (!res.ok) return
        const data = await res.json()
        setCourses(
          (data.courses ?? []).map((c: CourseOption) => ({
            id: c.id,
            name: c.name,
            active: c.active,
          }))
        )
      } catch {
        // ignore
      }
    }
    void loadCourses()
  }, [])

  const load = useCallback(async (q: string, courseId: string) => {
    try {
      const params = new URLSearchParams()
      if (q) params.set('q', q)
      if (courseId && courseId !== 'all') params.set('courseId', courseId)
      else params.set('courseId', 'all')

      const res = await fetch(`/api/admin/certificates?${params.toString()}`, {
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('Falha ao carregar certificados')
      const data = await res.json()
      setCertificates(data.certificates ?? [])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar certificados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setLoading(true)
    const delay = search.trim() ? 300 : 0
    const t = setTimeout(() => {
      void load(search.trim(), courseFilter)
    }, delay)
    return () => clearTimeout(t)
  }, [search, courseFilter, load])

  const courseOptions = [
    { value: 'all', label: 'Todos os cursos' },
    ...courses.map((c) => ({
      value: c.id,
      label: c.active === false ? `${c.name} (excluído)` : c.name,
    })),
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Certificados Emitidos</h1>
        <p className="text-sm text-slate-500 mt-1">
          <Link href="/admin/certificados" className="text-primary hover:underline">
            ← Voltar para Certificados
          </Link>
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Filtrar por curso"
          value={courseFilter}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
            setCourseFilter(e.target.value)
          }
          options={courseOptions}
        />
        <Input
          label="Buscar"
          placeholder="Aluno, usuário ou código..."
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
        />
      </div>

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex justify-center p-12">
            <Spinner size="lg" />
          </div>
        ) : certificates.length === 0 ? (
          <p className="p-8 text-center text-gray-500">
            Nenhum certificado encontrado
            {courseFilter !== 'all' ? ' para este curso' : ''}.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Curso</TableHead>
                <TableHead>Código</TableHead>
                <TableHead>Data de Emissão</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.student.full_name}</TableCell>
                  <TableCell className="text-sm text-slate-700">
                    {c.course?.name || c.course_name_snapshot || '—'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">{c.certificate_code}</TableCell>
                  <TableCell>{formatDateTime(c.completion_date || c.created_at)}</TableCell>
                  <TableCell>
                    {c.score_snapshot != null ? Number(c.score_snapshot).toFixed(1) : '—'}
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => viewCertificatePdf(c.id)}>
                      Visualizar
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        downloadCertificatePdf(c.id, `certificado-${c.certificate_code}.pdf`)
                      }
                    >
                      Baixar PDF
                    </Button>
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
