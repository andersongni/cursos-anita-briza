'use client'

import { useCallback, useEffect, useState } from 'react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { formatDateTime, formatDuration } from '@/lib/utils'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useParams } from 'next/navigation'
import { downloadCertificatePdf, viewCertificatePdf } from '@/lib/certificate/open-pdf'

type Profile = {
  id: string
  full_name: string
  username: string
  email: string | null
  phone: string | null
  status: string
  created_at: string
  last_login_at: string | null
  assessments: Array<{
    id: string
    type: string
    attempt_number: number
    score: number | null
    passed: boolean | null
    status: string
    started_at: string
    duration_seconds: number | null
  }>
  certificates: Array<{
    id: string
    certificate_code: string
    course_name_snapshot: string
    completion_date: string
    created_at: string
  }>
  releases: Array<{
    id: string
    created_at: string
    reason: string | null
    used: boolean
    cancelled: boolean
    releasedBy: { full_name: string }
  }>
}

export default function AlunoDetailPage() {
  const params = useParams<{ id: string }>()
  const [releaseModal, setReleaseModal] = useState(false)
  const [resetModal, setResetModal] = useState(false)
  const [reason, setReason] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/students/${params.id}`)
      if (!res.ok) throw new Error('Aluno não encontrado')
      const data = await res.json()
      setProfile(data.profile)
    } catch (e: any) {
      toast.error(e.message || 'Erro ao carregar aluno')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  useEffect(() => {
    load()
  }, [load])

  const handleRelease = async () => {
    try {
      const res = await fetch(`/api/admin/students/${params.id}/release-attempt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao liberar tentativa')
      toast.success('Nova tentativa liberada com sucesso.')
      setReleaseModal(false)
      setReason('')
      await load()
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const openResetModal = () => {
    setNewPassword('')
    setGeneratedPassword(null)
    setResetModal(true)
  }

  const handleResetPassword = async () => {
    setResetting(true)
    try {
      const res = await fetch(`/api/admin/students/${params.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          new_password: newPassword.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao resetar senha')
      setGeneratedPassword(data.temporary_password)
      toast.success('Senha redefinida com sucesso.')
    } catch (e: any) {
      toast.error(e.message)
    } finally {
      setResetting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500">Aluno não encontrado.</p>
        <Link href="/admin/alunos">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    )
  }

  const statusVariant =
    profile.status === 'APPROVED' ? 'success' : profile.status === 'BLOCKED' ? 'error' : 'warning'

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-secondary">Detalhes do Aluno</h1>
        <Link href="/admin/alunos">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle>Perfil</CardTitle>
          </CardHeader>
          <div className="p-4 pt-0 space-y-4">
            <div>
              <p className="text-sm text-gray-500">Nome</p>
              <p className="font-medium">{profile.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Usuário</p>
              <p className="font-medium">{profile.username}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Status</p>
              <Badge variant={statusVariant as any}>{profile.status}</Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Cadastro</p>
              <p>{formatDateTime(profile.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Último Acesso</p>
              <p>{profile.last_login_at ? formatDateTime(profile.last_login_at) : '—'}</p>
            </div>
            <div className="pt-2">
              <Button variant="outline" className="w-full" onClick={openResetModal}>
                Resetar senha
              </Button>
            </div>
          </div>
        </Card>

        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Avaliações</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0">
              {profile.assessments.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhuma avaliação registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Tentativa</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Resultado</TableHead>
                      <TableHead>Duração</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.assessments.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{formatDateTime(h.started_at)}</TableCell>
                        <TableCell>
                          <Badge variant={h.type === 'PROVA' ? 'default' : 'info'}>{h.type}</Badge>
                        </TableCell>
                        <TableCell>{h.attempt_number}</TableCell>
                        <TableCell>{h.score != null ? h.score.toFixed(1) : '—'}</TableCell>
                        <TableCell>
                          {h.status !== 'COMPLETED' ? (
                            <Badge variant="warning">{h.status}</Badge>
                          ) : (
                            <Badge variant={h.passed ? 'success' : 'error'}>
                              {h.passed ? 'APROVADO' : 'REPROVADO'}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          {h.duration_seconds != null ? formatDuration(h.duration_seconds) : '—'}
                        </TableCell>
                        <TableCell>
                          <Link href={`/admin/avaliacoes/${h.id}`}>
                            <Button size="sm" variant="ghost">
                              Ver
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader className="flex flex-row justify-between items-center">
              <CardTitle>Liberação de Tentativa</CardTitle>
              <Button size="sm" onClick={() => setReleaseModal(true)}>
                Liberar Nova Tentativa
              </Button>
            </CardHeader>
            <div className="p-4 pt-0">
              {profile.releases.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data de Liberação</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.releases.map((r) => (
                      <TableRow key={r.id}>
                        <TableCell>{formatDateTime(r.created_at)}</TableCell>
                        <TableCell>{r.reason || '—'}</TableCell>
                        <TableCell>
                          <Badge variant={r.used ? 'default' : r.cancelled ? 'error' : 'success'}>
                            {r.cancelled ? 'Cancelada' : r.used ? 'Utilizada' : 'Pendente'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-gray-500 text-sm">Nenhuma liberação extra registrada.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Certificados</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0">
              {profile.certificates.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhum certificado emitido.</p>
              ) : (
                <ul className="space-y-2">
                  {profile.certificates.map((cert) => (
                    <li
                      key={cert.id}
                      className="flex justify-between items-center p-3 border rounded-md gap-3 flex-wrap"
                    >
                      <div>
                        <p className="font-medium">
                          {cert.course_name_snapshot || 'Certificado de Conclusão'}
                        </p>
                        <p className="text-xs text-gray-500 font-mono">{cert.certificate_code}</p>
                        <p className="text-xs text-gray-500">
                          Emitido em {formatDateTime(cert.completion_date || cert.created_at)}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => viewCertificatePdf(cert.id)}
                        >
                          Visualizar
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            downloadCertificatePdf(
                              cert.id,
                              `certificado-${cert.certificate_code}.pdf`
                            )
                          }
                        >
                          Baixar PDF
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={releaseModal}
        onClose={() => setReleaseModal(false)}
        title="Liberar Nova Tentativa"
      >
        <div className="space-y-4">
          <p className="text-sm">
            Isso permitirá que o aluno realize a prova novamente, ignorando o tempo de espera ou o
            limite de tentativas.
          </p>
          <Input
            label="Motivo (opcional)"
            placeholder="Ex: Problemas de conexão relatados"
            value={reason}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setReason(e.target.value)}
          />
          <div className="flex justify-end space-x-2">
            <Button variant="ghost" onClick={() => setReleaseModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleRelease}>Confirmar Liberação</Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={resetModal}
        onClose={() => {
          setResetModal(false)
          setGeneratedPassword(null)
          setNewPassword('')
        }}
        title="Resetar senha do aluno"
      >
        <div className="space-y-4">
          {generatedPassword ? (
            <>
              <p className="text-sm text-slate-600">
                Senha redefinida para <strong>{profile.username}</strong>. Anote e informe ao aluno:
              </p>
              <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 font-mono text-lg text-center tracking-wide">
                {generatedPassword}
              </div>
              <p className="text-xs text-slate-500">
                Esta senha só é exibida agora. Peça ao aluno para trocá-la no próximo acesso, se
                desejar.
              </p>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    navigator.clipboard?.writeText(generatedPassword).catch(() => {})
                    setResetModal(false)
                    setGeneratedPassword(null)
                    setNewPassword('')
                  }}
                >
                  Copiar e fechar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Defina uma nova senha ou deixe em branco para gerar uma senha temporária
                automaticamente.
              </p>
              <Input
                label="Nova senha (opcional)"
                type="text"
                placeholder="Mínimo 6 caracteres, ou vazio para gerar"
                value={newPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewPassword(e.target.value)
                }
              />
              <div className="flex justify-end space-x-2">
                <Button variant="ghost" onClick={() => setResetModal(false)}>
                  Cancelar
                </Button>
                <Button loading={resetting} onClick={handleResetPassword}>
                  Confirmar reset
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
