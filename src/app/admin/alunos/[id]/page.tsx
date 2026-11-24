'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table'
import Modal from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import { formatDateTime, formatDuration } from '@/lib/utils'
import { formatDurationMs } from '@/lib/exercises/typing'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useParams, useSearchParams } from 'next/navigation'
import { downloadCertificatePdf, viewCertificatePdf } from '@/lib/certificate/open-pdf'

function formatReactionMs(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

type CourseOption = { id: string; name: string; slug: string }

type HistoryCounts = {
  assessments: number
  certificates: number
  typing: number
  mouse: number
  feedbacks: number
  total: number
}

type MergeIdentitySource = 'survivor' | 'absorbed'

type MergePreviewSide = {
  id: string
  username: string
  fullName: string
  email: string | null
  phone: string | null
  status: string
  history: HistoryCounts
}

function displayContact(value: string | null | undefined) {
  const v = value?.trim()
  return v ? v : '— (vazio)'
}

type Profile = {
  id: string
  full_name: string
  username: string
  email: string | null
  phone: string | null
  status: string
  deleted_at: string | null
  created_at: string
  last_login_at: string | null
  temporaryPassword?: {
    active: boolean
    expiresAt: string | null
    hours: number
  }
  openMerge?: {
    id: string
    role: 'survivor' | 'absorbed'
    canUndo: boolean
    undoError: string | null
    other: { id: string; username: string; fullName: string }
    createdAt: string
  } | null
  assessments: Array<{
    id: string
    type: string
    attempt_number: number
    score: number | null
    passed: boolean | null
    status: string
    started_at: string
    duration_seconds: number | null
    course?: { id: string; name: string } | null
  }>
  certificates: Array<{
    id: string
    certificate_code: string
    course_name_snapshot: string
    completion_date: string
    created_at: string
  }>
  enrollments: Array<{
    id: string
    course_id: string
    status: string
    course: CourseOption
  }>
  typingAttempts: Array<{
    id: string
    duration_ms: number
    error_count: number
    wpm: number
    accuracy: number
    score: number
    completed_at: string
    passage: { id: string; title: string }
  }>
  mouseAccuracyAttempts: Array<{
    id: string
    duration_ms: number
    hits: number
    misses: number
    expired: number
    points: number
    accuracy: number
    score: number
    max_combo: number
    avg_reaction_ms: number
    completed_at: string
  }>
}

export default function AlunoDetailPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const [resetModal, setResetModal] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)
  const [resetting, setResetting] = useState(false)
  const [tempModal, setTempModal] = useState(false)
  const [tempPasswordInput, setTempPasswordInput] = useState('')
  const [generatedTempPassword, setGeneratedTempPassword] = useState<string | null>(null)
  const [tempExpiresAt, setTempExpiresAt] = useState<string | null>(null)
  const [savingTemp, setSavingTemp] = useState(false)
  const [clearingTemp, setClearingTemp] = useState(false)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [courses, setCourses] = useState<CourseOption[]>([])
  const [savingEnrollment, setSavingEnrollment] = useState<string | null>(null)
  const [deleteModal, setDeleteModal] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [mergeModal, setMergeModal] = useState(false)
  const [mergeCandidates, setMergeCandidates] = useState<
    Array<{ id: string; full_name: string; username: string }>
  >([])
  const [mergeSearch, setMergeSearch] = useState('')
  const [absorbedId, setAbsorbedId] = useState('')
  const [mergePreview, setMergePreview] = useState<{
    survivor: MergePreviewSide
    absorbed: MergePreviewSide
  } | null>(null)
  const [keepUsernameFrom, setKeepUsernameFrom] =
    useState<MergeIdentitySource>('survivor')
  const [keepPasswordFrom, setKeepPasswordFrom] =
    useState<MergeIdentitySource>('survivor')
  const [keepFullNameFrom, setKeepFullNameFrom] =
    useState<MergeIdentitySource>('survivor')
  const [keepEmailFrom, setKeepEmailFrom] = useState<MergeIdentitySource>('survivor')
  const [keepPhoneFrom, setKeepPhoneFrom] = useState<MergeIdentitySource>('survivor')
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [merging, setMerging] = useState(false)
  const [undoingMerge, setUndoingMerge] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/students/${params.id}`)
      if (!res.ok) throw new Error('Aluno não encontrado')
      const data = await res.json()
      const p = data.profile
      setCourses(Array.isArray(data.courses) ? data.courses : [])
      setProfile({
        ...p,
        assessments: Array.isArray(p?.assessments) ? p.assessments : [],
        certificates: Array.isArray(p?.certificates) ? p.certificates : [],
        enrollments: Array.isArray(p?.enrollments) ? p.enrollments : [],
        typingAttempts: Array.isArray(p?.typingAttempts) ? p.typingAttempts : [],
        mouseAccuracyAttempts: Array.isArray(p?.mouseAccuracyAttempts)
          ? p.mouseAccuracyAttempts
          : [],
      })
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar aluno')
    } finally {
      setLoading(false)
    }
  }, [params.id])

  const setEnrollment = async (
    courseId: string,
    action: 'APPROVE' | 'REJECT' | 'REMOVE' | 'ENROLL'
  ) => {
    setSavingEnrollment(courseId)
    try {
      const res = await fetch(`/api/admin/students/${params.id}/enrollments`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId, action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar matrícula')
      setProfile((prev) =>
        prev
          ? {
              ...prev,
              enrollments: Array.isArray(data.enrollments) ? data.enrollments : prev.enrollments,
            }
          : prev
      )
      const messages = {
        APPROVE: 'Matrícula aprovada.',
        REJECT: 'Solicitação rejeitada.',
        REMOVE: 'Matrícula removida.',
        ENROLL: 'Aluno matriculado.',
      } as const
      toast.success(messages[action])
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao atualizar matrícula')
    } finally {
      setSavingEnrollment(null)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  const resetOpenedFromQuery = useRef(false)

  const openResetModal = useCallback(() => {
    setNewPassword('')
    setGeneratedPassword(null)
    setResetModal(true)
  }, [])

  useEffect(() => {
    if (loading || !profile) return
    if (searchParams.get('resetPassword') !== '1') return
    if (resetOpenedFromQuery.current) return
    resetOpenedFromQuery.current = true
    openResetModal()
  }, [loading, profile, searchParams, openResetModal])

  const copyPassword = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      toast.success('Senha copiada.')
      return true
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.')
      return false
    }
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
      const pwd =
        typeof data.temporary_password === 'string' ? data.temporary_password : ''
      setGeneratedPassword(pwd)
      toast.success('Senha redefinida. Copie antes de fechar.')
      if (pwd) {
        void copyPassword(pwd)
      }
      // Recarrega em background sem fechar o modal nem limpar a senha exibida
      void load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao resetar senha')
    } finally {
      setResetting(false)
    }
  }

  const openTempModal = () => {
    setTempPasswordInput('')
    setGeneratedTempPassword(null)
    setTempExpiresAt(null)
    setTempModal(true)
  }

  const handleSetTempPassword = async () => {
    setSavingTemp(true)
    try {
      const res = await fetch(`/api/admin/students/${params.id}/temporary-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          password: tempPasswordInput.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao definir senha temporária')
      setGeneratedTempPassword(data.temporary_password)
      setTempExpiresAt(
        typeof data.expiresAt === 'string' ? data.expiresAt : null
      )
      toast.success('Senha temporária definida por 2 horas.')
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao definir senha temporária')
    } finally {
      setSavingTemp(false)
    }
  }

  const handleClearTempPassword = async () => {
    setClearingTemp(true)
    try {
      const res = await fetch(`/api/admin/students/${params.id}/temporary-password`, {
        method: 'DELETE',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao revogar senha temporária')
      toast.success('Senha temporária revogada.')
      setTempModal(false)
      setGeneratedTempPassword(null)
      setTempExpiresAt(null)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao revogar senha temporária')
    } finally {
      setClearingTemp(false)
    }
  }

  const handleSoftDelete = async () => {
    setDeleting(true)
    try {
      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: params.id, action: 'DELETE' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao excluir aluno')
      toast.success('Aluno excluído com sucesso.')
      setDeleteModal(false)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao excluir aluno')
    } finally {
      setDeleting(false)
    }
  }

  const handleRestore = async () => {
    setRestoring(true)
    try {
      const res = await fetch('/api/admin/students', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: params.id, action: 'RESTORE' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao restaurar aluno')
      toast.success('Aluno restaurado com sucesso.')
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao restaurar aluno')
    } finally {
      setRestoring(false)
    }
  }

  const openMergeModal = async () => {
    setMergeModal(true)
    setAbsorbedId('')
    setMergePreview(null)
    setMergeSearch('')
    setKeepUsernameFrom('survivor')
    setKeepPasswordFrom('survivor')
    setKeepFullNameFrom('survivor')
    setKeepEmailFrom('survivor')
    setKeepPhoneFrom('survivor')
    try {
      const res = await fetch(
        `/api/admin/students?enrollment=ALL&deleted=exclude`,
        { cache: 'no-store' }
      )
      if (!res.ok) throw new Error('Falha ao listar alunos')
      const data = await res.json()
      const list = Array.isArray(data.profiles) ? data.profiles : []
      setMergeCandidates(
        list
          .filter(
            (s: { id: string; deleted_at?: string | null }) =>
              s.id !== params.id && !s.deleted_at
          )
          .map((s: { id: string; full_name: string; username: string }) => ({
            id: s.id,
            full_name: s.full_name,
            username: s.username,
          }))
      )
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao listar alunos')
    }
  }

  const loadMergePreview = async (otherId: string) => {
    if (!otherId) {
      setMergePreview(null)
      return
    }
    setLoadingPreview(true)
    try {
      const q = new URLSearchParams({
        survivorId: params.id,
        absorbedId: otherId,
      })
      const res = await fetch(`/api/admin/students/merge?${q}`)
      const data = await res.json()
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Não foi possível pré-visualizar o merge')
      }
      setMergePreview({ survivor: data.survivor, absorbed: data.absorbed })
      setKeepUsernameFrom('survivor')
      setKeepPasswordFrom('survivor')
      setKeepFullNameFrom('survivor')
      setKeepEmailFrom('survivor')
      setKeepPhoneFrom('survivor')
    } catch (e: unknown) {
      setMergePreview(null)
      toast.error(e instanceof Error ? e.message : 'Erro na prévia do merge')
    } finally {
      setLoadingPreview(false)
    }
  }

  const handleMerge = async () => {
    if (!absorbedId || !mergePreview) return
    setMerging(true)
    try {
      const res = await fetch('/api/admin/students/merge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          survivorId: params.id,
          absorbedId,
          keepUsernameFrom,
          keepPasswordFrom,
          keepFullNameFrom,
          keepEmailFrom,
          keepPhoneFrom,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao mesclar alunos')
      toast.success('Alunos mesclados. O histórico de ambos foi mantido nesta conta.')
      setMergeModal(false)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao mesclar alunos')
    } finally {
      setMerging(false)
    }
  }

  const handleUndoMerge = async () => {
    if (!profile?.openMerge?.id) return
    setUndoingMerge(true)
    try {
      const res = await fetch(
        `/api/admin/students/merge/${profile.openMerge.id}/undo`,
        { method: 'POST' }
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao desfazer merge')
      toast.success('Merge desfeito. As contas foram restauradas.')
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao desfazer merge')
    } finally {
      setUndoingMerge(false)
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

  const isDeleted = profile.deleted_at != null
  const statusVariant = isDeleted
    ? 'outline'
    : profile.status === 'APPROVED'
      ? 'success'
      : profile.status === 'BLOCKED'
        ? 'error'
        : 'warning'

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
              <div className="flex flex-wrap gap-2">
                {isDeleted && <Badge variant="outline">Excluído</Badge>}
                <Badge variant={statusVariant as 'success' | 'error' | 'warning' | 'outline'}>
                  {profile.status}
                </Badge>
              </div>
            </div>
            {isDeleted && (
              <div>
                <p className="text-sm text-gray-500">Excluído em</p>
                <p>{formatDateTime(profile.deleted_at!)}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500">Cadastro</p>
              <p>{formatDateTime(profile.created_at)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Último Acesso</p>
              <p>{profile.last_login_at ? formatDateTime(profile.last_login_at) : '—'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-2">Matrículas</p>
              <ul className="space-y-3">
                {courses.map((course) => {
                  const enrollment = profile.enrollments.find((e) => e.course_id === course.id)
                  const status = enrollment?.status
                  const busy = savingEnrollment === course.id
                  return (
                    <li key={course.id} className="space-y-1.5 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium text-slate-800">{course.name}</span>
                        {status === 'ACTIVE' && <Badge variant="success">Ativa</Badge>}
                        {status === 'PENDING' && <Badge variant="warning">Solicitada</Badge>}
                        {status === 'REJECTED' && <Badge variant="error">Rejeitada</Badge>}
                        {status === 'INACTIVE' && <Badge variant="outline">Inativa</Badge>}
                        {!status && <Badge variant="outline">Sem solicitação</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {status === 'PENDING' && (
                          <>
                            <Button
                              size="sm"
                              variant="primary"
                              loading={busy}
                              disabled={isDeleted || busy}
                              onClick={() => void setEnrollment(course.id, 'APPROVE')}
                            >
                              Aprovar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              loading={busy}
                              disabled={isDeleted || busy}
                              onClick={() => void setEnrollment(course.id, 'REJECT')}
                            >
                              Rejeitar
                            </Button>
                          </>
                        )}
                        {status === 'ACTIVE' && (
                          <Button
                            size="sm"
                            variant="outline"
                            loading={busy}
                            disabled={isDeleted || busy}
                            onClick={() => void setEnrollment(course.id, 'REMOVE')}
                          >
                            Remover
                          </Button>
                        )}
                        {(status === 'REJECTED' ||
                          status === 'INACTIVE' ||
                          !status) && (
                          <Button
                            size="sm"
                            variant="primary"
                            loading={busy}
                            disabled={isDeleted || busy}
                            onClick={() => void setEnrollment(course.id, 'ENROLL')}
                          >
                            Matricular
                          </Button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
            <div className="pt-2 space-y-2">
              {profile.openMerge ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 space-y-2">
                  <p>
                    {profile.openMerge.role === 'survivor' ? (
                      <>
                        Conta resultante de merge com{' '}
                        <strong>{profile.openMerge.other.fullName}</strong> (@
                        {profile.openMerge.other.username}).
                      </>
                    ) : (
                      <>
                        Esta conta foi absorvida por{' '}
                        <strong>{profile.openMerge.other.fullName}</strong> (@
                        {profile.openMerge.other.username}).
                      </>
                    )}
                  </p>
                  <p className="text-xs text-slate-500">
                    Em {formatDateTime(profile.openMerge.createdAt)}.
                  </p>
                  {profile.openMerge.canUndo ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      loading={undoingMerge}
                      onClick={() => void handleUndoMerge()}
                    >
                      Desfazer merge
                    </Button>
                  ) : (
                    <p className="text-xs text-amber-800">
                      {profile.openMerge.undoError ||
                        'Não é possível desfazer este merge.'}
                    </p>
                  )}
                </div>
              ) : null}
              {!isDeleted && (
                <>
                  {profile.temporaryPassword?.active && profile.temporaryPassword.expiresAt ? (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      Senha temporária ativa até{' '}
                      <strong>{formatDateTime(profile.temporaryPassword.expiresAt)}</strong>. A
                      senha original continua válida.
                    </div>
                  ) : null}
                  {!profile.openMerge && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => void openMergeModal()}
                    >
                      Mesclar com outro aluno
                    </Button>
                  )}
                  <Button variant="outline" className="w-full" onClick={openTempModal}>
                    Senha temporária (2h)
                  </Button>
                  <Button variant="outline" className="w-full" onClick={openResetModal}>
                    Resetar senha
                  </Button>
                  <Button variant="danger" className="w-full" onClick={() => setDeleteModal(true)}>
                    Excluir aluno
                  </Button>
                </>
              )}
              {isDeleted && (
                <Button
                  variant="success"
                  className="w-full"
                  loading={restoring}
                  onClick={() => void handleRestore()}
                >
                  Restaurar aluno
                </Button>
              )}
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
            <CardHeader>
              <CardTitle>Certificados</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0">
              {(profile.certificates?.length ?? 0) === 0 ? (
                <p className="text-gray-500 text-sm">Nenhum certificado emitido.</p>
              ) : (
                <ul className="space-y-2">
                  {(profile.certificates ?? []).map((cert) => (
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
                          Emitido em {formatDateTime(cert.completion_date ?? cert.created_at)}
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

          <Card>
            <CardHeader>
              <CardTitle>Digitação</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 overflow-x-auto">
              {profile.typingAttempts.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhuma prática de digitação registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Texto</TableHead>
                      <TableHead>Tempo</TableHead>
                      <TableHead>Erros</TableHead>
                      <TableHead>PPM</TableHead>
                      <TableHead>Precisão</TableHead>
                      <TableHead>Nota</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.typingAttempts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(a.completed_at)}
                        </TableCell>
                        <TableCell className="max-w-[12rem]">
                          <span className="block truncate" title={a.passage.title}>
                            {a.passage.title}
                          </span>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatDurationMs(a.duration_ms)}
                        </TableCell>
                        <TableCell className="tabular-nums">{a.error_count}</TableCell>
                        <TableCell className="tabular-nums">{a.wpm.toFixed(1)}</TableCell>
                        <TableCell className="tabular-nums">{a.accuracy.toFixed(1)}%</TableCell>
                        <TableCell className="tabular-nums font-semibold">
                          {a.score}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Precisão do mouse</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 overflow-x-auto">
              {profile.mouseAccuracyAttempts.length === 0 ? (
                <p className="text-gray-500 text-sm">Nenhuma partida registrada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Nota</TableHead>
                      <TableHead>Pontos</TableHead>
                      <TableHead>Acertos</TableHead>
                      <TableHead>Erros</TableHead>
                      <TableHead>Sumiram</TableHead>
                      <TableHead>Precisão</TableHead>
                      <TableHead>Reação</TableHead>
                      <TableHead>Sequência</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {profile.mouseAccuracyAttempts.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatDateTime(a.completed_at)}
                        </TableCell>
                        <TableCell className="tabular-nums font-semibold">{a.score}</TableCell>
                        <TableCell className="tabular-nums">{a.points}</TableCell>
                        <TableCell className="tabular-nums">{a.hits}</TableCell>
                        <TableCell className="tabular-nums">{a.misses}</TableCell>
                        <TableCell className="tabular-nums">{a.expired}</TableCell>
                        <TableCell className="tabular-nums">{a.accuracy.toFixed(1)}%</TableCell>
                        <TableCell className="tabular-nums">
                          {formatReactionMs(a.avg_reaction_ms)}
                        </TableCell>
                        <TableCell className="tabular-nums">{a.max_combo}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal
        isOpen={deleteModal}
        onClose={() => setDeleteModal(false)}
        title="Excluir aluno"
      >
        <div className="space-y-4">
          <p>
            Tem certeza que deseja excluir <strong>{profile.full_name}</strong>?
          </p>
          <p className="text-sm text-gray-500">
            A exclusão é lógica: o aluno sai das métricas e não consegue mais entrar. O histórico
            permanece e a conta pode ser restaurada depois.
          </p>
          <div className="flex justify-end space-x-2">
            <Button variant="ghost" onClick={() => setDeleteModal(false)}>
              Cancelar
            </Button>
            <Button variant="danger" loading={deleting} onClick={() => void handleSoftDelete()}>
              Confirmar exclusão
            </Button>
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
              <input
                readOnly
                className="w-full bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 font-mono text-lg text-center tracking-wide select-all"
                value={generatedPassword}
                onFocus={(e) => e.currentTarget.select()}
                aria-label="Nova senha"
              />
              <p className="text-xs text-slate-500">
                Esta senha só é exibida agora. Copie antes de fechar o diálogo.
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => void copyPassword(generatedPassword)}
                >
                  Copiar
                </Button>
                <Button
                  onClick={() => {
                    setResetModal(false)
                    setGeneratedPassword(null)
                    setNewPassword('')
                  }}
                >
                  Fechar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Substitui a senha atual do aluno de forma definitiva (sem pedir troca no login).
                Deixe em branco para gerar automaticamente (maiúsculas, minúsculas, número e
                caractere especial). Se definir manualmente, use as mesmas regras (mín. 8).
              </p>
              <Input
                label="Nova senha (opcional)"
                type="text"
                placeholder="Vazio para gerar, ou senha forte (ex.: Abcd12!@)"
                value={newPassword}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setNewPassword(e.target.value)
                }
              />
              <div className="flex justify-end space-x-2">
                <Button variant="ghost" onClick={() => setResetModal(false)}>
                  Cancelar
                </Button>
                <Button loading={resetting} onClick={() => void handleResetPassword()}>
                  Confirmar reset
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={mergeModal}
        onClose={() => {
          setMergeModal(false)
          setMergePreview(null)
          setAbsorbedId('')
        }}
        title="Mesclar alunos"
        size="xl"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Esta conta (<strong>{profile.full_name}</strong> @{profile.username}) permanece.
            A outra é absorvida: histórico de avaliações, exercícios e certificados dos dois fica
            aqui. Escolha nome, usuário, senha (não exibida), e-mail e telefone a manter.
          </p>
          <Input
            label="Buscar aluno a absorver"
            value={mergeSearch}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
              setMergeSearch(e.target.value)
            }
            placeholder="Nome ou usuário"
          />
          <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y">
            {mergeCandidates
              .filter((c) => {
                const q = mergeSearch.trim().toLowerCase()
                if (!q) return true
                return (
                  c.full_name.toLowerCase().includes(q) ||
                  c.username.toLowerCase().includes(q)
                )
              })
              .slice(0, 40)
              .map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 ${
                    absorbedId === c.id ? 'bg-slate-100 font-medium' : ''
                  }`}
                  onClick={() => {
                    setAbsorbedId(c.id)
                    void loadMergePreview(c.id)
                  }}
                >
                  {c.full_name}{' '}
                  <span className="text-slate-500">@{c.username}</span>
                </button>
              ))}
            {mergeCandidates.length === 0 ? (
              <p className="px-3 py-2 text-sm text-slate-500">Nenhum aluno disponível.</p>
            ) : null}
          </div>

          {loadingPreview ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : null}

          {mergePreview ? (
            <div className="space-y-3 rounded-lg border border-slate-200 p-3 text-sm">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Conta principal</p>
                  <p className="font-medium">{mergePreview.survivor.fullName}</p>
                  <p className="text-slate-600">@{mergePreview.survivor.username}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Histórico: {mergePreview.survivor.history.assessments} aval.,{' '}
                    {mergePreview.survivor.history.certificates} cert.,{' '}
                    {mergePreview.survivor.history.typing + mergePreview.survivor.history.mouse}{' '}
                    exercícios
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Será absorvida</p>
                  <p className="font-medium">{mergePreview.absorbed.fullName}</p>
                  <p className="text-slate-600">@{mergePreview.absorbed.username}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Histórico: {mergePreview.absorbed.history.assessments} aval.,{' '}
                    {mergePreview.absorbed.history.certificates} cert.,{' '}
                    {mergePreview.absorbed.history.typing + mergePreview.absorbed.history.mouse}{' '}
                    exercícios
                  </p>
                </div>
              </div>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">
                  Nome completo a manter
                </legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepFullName"
                    checked={keepFullNameFrom === 'survivor'}
                    onChange={() => setKeepFullNameFrom('survivor')}
                  />
                  <span>{mergePreview.survivor.fullName}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepFullName"
                    checked={keepFullNameFrom === 'absorbed'}
                    onChange={() => setKeepFullNameFrom('absorbed')}
                  />
                  <span>{mergePreview.absorbed.fullName}</span>
                </label>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">
                  Nome de usuário a manter
                </legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepUsername"
                    checked={keepUsernameFrom === 'survivor'}
                    onChange={() => setKeepUsernameFrom('survivor')}
                  />
                  <span>@{mergePreview.survivor.username}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepUsername"
                    checked={keepUsernameFrom === 'absorbed'}
                    onChange={() => setKeepUsernameFrom('absorbed')}
                  />
                  <span>@{mergePreview.absorbed.username}</span>
                </label>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">
                  Senha a manter (não é exibida)
                </legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepPassword"
                    checked={keepPasswordFrom === 'survivor'}
                    onChange={() => setKeepPasswordFrom('survivor')}
                  />
                  <span>Senha de @{mergePreview.survivor.username}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepPassword"
                    checked={keepPasswordFrom === 'absorbed'}
                    onChange={() => setKeepPasswordFrom('absorbed')}
                  />
                  <span>Senha de @{mergePreview.absorbed.username}</span>
                </label>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">
                  E-mail a manter
                </legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepEmail"
                    checked={keepEmailFrom === 'survivor'}
                    onChange={() => setKeepEmailFrom('survivor')}
                  />
                  <span>{displayContact(mergePreview.survivor.email)}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepEmail"
                    checked={keepEmailFrom === 'absorbed'}
                    onChange={() => setKeepEmailFrom('absorbed')}
                  />
                  <span>{displayContact(mergePreview.absorbed.email)}</span>
                </label>
              </fieldset>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium text-slate-800">
                  Telefone a manter
                </legend>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepPhone"
                    checked={keepPhoneFrom === 'survivor'}
                    onChange={() => setKeepPhoneFrom('survivor')}
                  />
                  <span>{displayContact(mergePreview.survivor.phone)}</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="keepPhone"
                    checked={keepPhoneFrom === 'absorbed'}
                    onChange={() => setKeepPhoneFrom('absorbed')}
                  />
                  <span>{displayContact(mergePreview.absorbed.phone)}</span>
                </label>
              </fieldset>
            </div>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setMergeModal(false)}>
              Cancelar
            </Button>
            <Button
              loading={merging}
              disabled={!mergePreview || !absorbedId}
              onClick={() => void handleMerge()}
            >
              Confirmar merge
            </Button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={tempModal}
        onClose={() => {
          setTempModal(false)
          setGeneratedTempPassword(null)
          setTempPasswordInput('')
          setTempExpiresAt(null)
        }}
        title="Senha temporária (2 horas)"
      >
        <div className="space-y-4">
          {generatedTempPassword ? (
            <>
              <p className="text-sm text-slate-600">
                Senha temporária para <strong>{profile.username}</strong>. A senha original{' '}
                <strong>não foi alterada</strong>.
              </p>
              <div className="bg-slate-100 border border-slate-200 rounded-lg px-4 py-3 font-mono text-lg text-center tracking-wide">
                {generatedTempPassword}
              </div>
              {tempExpiresAt ? (
                <p className="text-sm text-slate-600">
                  Válida até <strong>{formatDateTime(tempExpiresAt)}</strong> (2 horas).
                </p>
              ) : null}
              <p className="text-xs text-slate-500">
                Esta senha só é exibida agora. Depois disso, o aluno volta a usar só a senha
                original (ou uma nova temporária).
              </p>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard?.writeText(generatedTempPassword).catch(() => {})
                    toast.success('Senha copiada.')
                  }}
                >
                  Copiar
                </Button>
                <Button
                  onClick={() => {
                    setTempModal(false)
                    setGeneratedTempPassword(null)
                    setTempPasswordInput('')
                    setTempExpiresAt(null)
                  }}
                >
                  Fechar
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600">
                Cria um acesso paralelo por <strong>2 horas</strong>, sem substituir a senha
                original do aluno. Útil para suporte pontual.
              </p>
              {profile.temporaryPassword?.active && profile.temporaryPassword.expiresAt ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  Já existe uma senha temporária ativa até{' '}
                  {formatDateTime(profile.temporaryPassword.expiresAt)}. Definir outra substitui a
                  atual.
                </div>
              ) : null}
              <Input
                label="Senha temporária (opcional)"
                type="text"
                placeholder="Mínimo 6 caracteres, ou vazio para gerar"
                value={tempPasswordInput}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                  setTempPasswordInput(e.target.value)
                }
              />
              <div className="flex flex-wrap justify-end gap-2">
                {profile.temporaryPassword?.active ? (
                  <Button
                    variant="outline"
                    loading={clearingTemp}
                    onClick={() => void handleClearTempPassword()}
                  >
                    Revogar atual
                  </Button>
                ) : null}
                <Button variant="ghost" onClick={() => setTempModal(false)}>
                  Cancelar
                </Button>
                <Button loading={savingTemp} onClick={() => void handleSetTempPassword()}>
                  Ativar por 2h
                </Button>
              </div>
            </>
          )}
        </div>
      </Modal>
    </div>
  )
}
