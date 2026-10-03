'use client'

import { useState, useEffect, useCallback } from 'react'
import Card, { CardHeader, CardTitle, CardContent, CardFooter, CardDescription } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import { Award, Download, Eye, FileCheck2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { downloadCertificatePdf, viewCertificatePdf } from '@/lib/certificate/open-pdf'

type Certificate = {
  id: string
  certificate_code: string
  course_name_snapshot: string
  completion_date: string
  score_snapshot: number | null
  created_at: string
}

export default function CertificadosPage() {
  const [loading, setLoading] = useState(true)
  const [emitting, setEmitting] = useState(false)
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [eligibleAssessmentId, setEligibleAssessmentId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/certificates')
      if (!res.ok) throw new Error('Falha ao carregar certificados')
      const data = await res.json()
      setCertificates(data.certificates ?? [])
      setEligibleAssessmentId(data.eligibleAssessmentId ?? null)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar certificados')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const handleEmit = async () => {
    if (!eligibleAssessmentId) return
    setEmitting(true)
    try {
      const res = await fetch('/api/certificates/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assessment_id: eligibleAssessmentId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao emitir certificado')
      toast.success('Certificado emitido com sucesso!')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setEmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <div className="bg-green-100 p-3 rounded-full">
          <Award className="w-8 h-8 text-green-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Meus Certificados</h1>
          <p className="text-slate-600 mt-1">Gerencie e baixe seus certificados de conclusão.</p>
        </div>
      </div>

      {eligibleAssessmentId && (
        <Card className="bg-green-50 border-green-200">
          <CardContent className="flex items-center justify-between p-6 gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <FileCheck2 className="w-10 h-10 text-green-600" />
              <div>
                <h3 className="font-bold text-green-900 text-lg">Certificado Disponível!</h3>
                <p className="text-green-700">
                  Você foi aprovado na prova oficial e já pode emitir seu certificado.
                </p>
              </div>
            </div>
            <Button
              className="bg-green-600 hover:bg-green-700"
              onClick={handleEmit}
              loading={emitting}
            >
              Emitir Agora
            </Button>
          </CardContent>
        </Card>
      )}

      {certificates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {certificates.map((cert) => (
            <Card
              key={cert.id}
              className="border-2 border-slate-200 hover:border-green-300 transition-colors"
            >
              <CardHeader className="pb-4">
                <CardTitle className="text-xl flex items-center justify-between">
                  <span>{cert.course_name_snapshot || 'Informática Básica'}</span>
                  <Award className="w-6 h-6 text-green-500" />
                </CardTitle>
                <CardDescription className="font-mono text-xs mt-2 bg-slate-100 p-2 rounded inline-block">
                  CÓDIGO: {cert.certificate_code}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-sm text-slate-600 space-y-2">
                <div className="flex justify-between">
                  <span className="font-semibold text-slate-700">Data de Emissão:</span>
                  <span>{formatDate(cert.completion_date || cert.created_at)}</span>
                </div>
              </CardContent>
              <CardFooter className="pt-4 border-t border-slate-100 flex gap-2">
                <Button
                  className="flex-1 flex items-center justify-center gap-2"
                  variant="ghost"
                  onClick={() => viewCertificatePdf(cert.id)}
                >
                  <Eye className="w-4 h-4" /> Visualizar
                </Button>
                <Button
                  className="flex-1 flex items-center justify-center gap-2"
                  variant="outline"
                  onClick={() =>
                    downloadCertificatePdf(cert.id, `certificado-${cert.certificate_code}.pdf`)
                  }
                >
                  <Download className="w-4 h-4" /> Baixar PDF
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="border-dashed border-2 border-slate-300 bg-slate-50">
          <CardContent className="flex flex-col items-center justify-center p-12 text-center text-slate-500 space-y-4">
            <Award className="w-16 h-16 text-slate-300" />
            <p className="max-w-md text-lg">
              Você ainda não possui certificados. Seja aprovado na prova oficial para emitir seu
              certificado de conclusão.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
