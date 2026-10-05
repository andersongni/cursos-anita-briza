'use client'

import { useCallback, useEffect, useState } from 'react'
import Card, { CardHeader, CardTitle, CardDescription } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Badge from '@/components/ui/Badge'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'

type Course = {
  id: string
  name: string
  description: string | null
  hours: number
}

export default function StudentMatriculasPage() {
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [switching, setSwitching] = useState<string | null>(null)
  const [active, setActive] = useState<Course[]>([])
  const [pending, setPending] = useState<Course[]>([])
  const [available, setAvailable] = useState<Course[]>([])
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/student/courses', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao carregar matrículas')
      const activeList: Course[] = Array.isArray(data.active) ? data.active : data.courses ?? []
      setActive(activeList)
      setPending(Array.isArray(data.pending) ? data.pending : [])
      setAvailable(Array.isArray(data.available) ? data.available : [])
      setActiveCourseId(
        typeof data.activeCourseId === 'string'
          ? data.activeCourseId
          : activeList[0]?.id ?? null
      )
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar matrículas')
    } finally {
      setLoading(false)
    }
  }, [])

  const useCourse = async (courseId: string) => {
    if (courseId === activeCourseId) return
    setSwitching(courseId)
    try {
      const res = await fetch('/api/student/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao alternar curso')
      toast.success('Curso alterado.')
      window.location.href = '/dashboard'
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao alternar curso')
      setSwitching(null)
    }
  }

  useEffect(() => {
    void load()
  }, [load])

  const request = async (courseId: string) => {
    setRequesting(courseId)
    try {
      const res = await fetch('/api/student/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao solicitar matrícula')
      toast.success(data.message || 'Solicitação enviada.')
      setLoading(true)
      await load()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao solicitar matrícula')
    } finally {
      setRequesting(null)
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
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Matrículas</h1>
        <p className="text-slate-600 mt-2">
          Solicite matrícula nos cursos desejados. A aprovação é feita pelo administrador.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Matrículas ativas</CardTitle>
          <CardDescription>
            Cursos em que você já pode fazer provas e simulados.
            {active.length > 1
              ? ' Use o botão para alternar o curso em uso na plataforma.'
              : ''}
          </CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-3">
          {active.length === 0 ? (
            <p className="text-sm text-slate-500">
              Nenhuma matrícula ativa ainda. Solicite um curso abaixo e aguarde a aprovação.
            </p>
          ) : (
            active.map((c) => {
              const inUse = c.id === activeCourseId
              return (
                <div
                  key={c.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border p-3 ${
                    inUse
                      ? 'border-primary/40 bg-sky-50/60'
                      : 'border-slate-200'
                  }`}
                >
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      {inUse ? (
                        <Badge variant="success">Em uso</Badge>
                      ) : (
                        <Badge variant="outline">Ativa</Badge>
                      )}
                    </div>
                    {c.description && (
                      <p className="text-sm text-slate-500 mt-1">{c.description}</p>
                    )}
                  </div>
                  {active.length > 1 && (
                    <Button
                      size="sm"
                      variant={inUse ? 'outline' : 'primary'}
                      disabled={inUse || switching === c.id}
                      loading={switching === c.id}
                      onClick={() => void useCourse(c.id)}
                    >
                      {inUse ? 'Curso atual' : 'Usar este curso'}
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Solicitações pendentes</CardTitle>
          <CardDescription>Aguardando aprovação do administrador.</CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-3">
          {pending.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma solicitação pendente.</p>
          ) : (
            pending.map((c) => (
              <div
                key={c.id}
                className="flex items-start justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  {c.description && (
                    <p className="text-sm text-slate-500 mt-1">{c.description}</p>
                  )}
                </div>
                <Badge variant="warning">Pendente</Badge>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Solicitar novo curso</CardTitle>
          <CardDescription>
            Escolha um curso em que ainda não está matriculado.
          </CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 space-y-3">
          {available.length === 0 ? (
            <p className="text-sm text-slate-500">
              Não há outros cursos disponíveis para solicitar no momento.
            </p>
          ) : (
            available.map((c) => (
              <div
                key={c.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
              >
                <div>
                  <p className="font-medium text-slate-900">{c.name}</p>
                  {c.description && (
                    <p className="text-sm text-slate-500 mt-1">{c.description}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">{c.hours}h</p>
                </div>
                <Button
                  size="sm"
                  loading={requesting === c.id}
                  disabled={requesting === c.id}
                  onClick={() => void request(c.id)}
                >
                  Solicitar matrícula
                </Button>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  )
}
