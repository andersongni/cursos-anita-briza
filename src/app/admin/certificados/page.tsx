'use client'

import { useCallback, useEffect, useState } from 'react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { formatDateTime } from '@/lib/utils'
import toast from 'react-hot-toast'
import { downloadCertificatePdf, viewCertificatePdf } from '@/lib/certificate/open-pdf'

type CertificateRow = {
  id: string
  certificate_code: string
  completion_date: string
  score_snapshot: number | null
  created_at: string
  student: { id: string; full_name: string; username: string }
}

export default function AdminCertificadosPage() {
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [certificates, setCertificates] = useState<CertificateRow[]>([])

  const load = useCallback(async (q?: string) => {
    try {
      const url = q
        ? `/api/admin/certificates?q=${encodeURIComponent(q)}`
        : '/api/admin/certificates'
      const res = await fetch(url)
      if (!res.ok) throw new Error('Falha ao carregar certificados')
      const data = await res.json()
      setCertificates(data.certificates ?? [])
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar certificados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => {
      setLoading(true)
      load(search.trim() || undefined)
    }, search ? 300 : 0)
    return () => clearTimeout(t)
  }, [search, load])

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-secondary">Certificados Emitidos</h1>

      <div className="bg-white p-4 rounded-lg shadow-sm">
        <Input
          placeholder="Buscar por aluno ou código..."
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
        ) : certificates.length === 0 ? (
          <p className="p-8 text-center text-gray-500">Nenhum certificado emitido ainda.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aluno</TableHead>
                <TableHead>Código de Autenticidade</TableHead>
                <TableHead>Data de Emissão</TableHead>
                <TableHead>Nota</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {certificates.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.student.full_name}</TableCell>
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
