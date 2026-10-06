'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Card, { CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Input from '@/components/ui/Input'
import Spinner from '@/components/ui/Spinner'
import toast from 'react-hot-toast'
import { useAdminCourse } from '@/components/courses/AdminCourseProvider'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

function asString(v: unknown, fallback = ''): string {
  if (v == null) return fallback
  return String(v)
}

function clampPercent(n: number): number {
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, Math.floor(n)))
}

export default function AdminParametrosPage() {
  const { activeCourse, activeCourseId, loading: courseLoading } = useAdminCourse()
  const [loading, setLoading] = useState(true)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [questionCount, setQuestionCount] = useState('40')
  const [discursiveCount, setDiscursiveCount] = useState('2')
  const [mcWeight, setMcWeight] = useState('80')
  const [discursiveWeight, setDiscursiveWeight] = useState('20')
  const [timeLimitMinutes, setTimeLimitMinutes] = useState('120')
  const [passingScore, setPassingScore] = useState('70')
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})
  const readyRef = useRef(false)
  const savedLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const load = useCallback(async () => {
    if (!activeCourseId) return
    readyRef.current = false
    setLoading(true)
    try {
      const res = await fetch('/api/admin/settings', { cache: 'no-store' })
      if (!res.ok) throw new Error('Falha ao carregar parâmetros')
      const data = await res.json()
      const map: Record<string, unknown> = {}
      for (const s of data.settings ?? []) {
        map[s.key] = s.value
      }
      setQuestionCount(asString(map['assessment.prova.question_count'], '40'))
      setDiscursiveCount(asString(map['assessment.prova.discursive_count'], '2'))
      setMcWeight(asString(map['assessment.prova.mc_weight_percent'], '80'))
      setDiscursiveWeight(asString(map['assessment.prova.discursive_weight_percent'], '20'))
      setTimeLimitMinutes(asString(map['assessment.prova.time_limit_minutes'], '120'))
      setPassingScore(asString(map['assessment.prova.passing_score'], '70'))
      readyRef.current = true
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [activeCourseId])

  useEffect(() => {
    if (courseLoading || !activeCourseId) return
    void load()
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout)
      if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
    }
  }, [load, courseLoading, activeCourseId])

  const persistKey = useCallback(
    async (key: string, value: number) => {
      if (!activeCourseId) return
      setSaveStatus('saving')
      try {
        const res = await fetch('/api/admin/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key, value, courseId: activeCourseId }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error(data.error || 'Erro ao salvar')
        }
        setSaveStatus('saved')
        if (savedLabelTimer.current) clearTimeout(savedLabelTimer.current)
        savedLabelTimer.current = setTimeout(() => setSaveStatus('idle'), 1500)
      } catch (e: unknown) {
        setSaveStatus('error')
        toast.error(e instanceof Error ? e.message : 'Erro ao salvar')
      }
    },
    [activeCourseId]
  )

  const scheduleSave = (key: string, raw: string) => {
    if (!readyRef.current) return
    const n = Number(raw)
    if (!Number.isFinite(n)) return
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => {
      void persistKey(key, n)
    }, 500)
  }

  const scheduleWeightPair = (changed: 'mc' | 'discursive', raw: string) => {
    if (!readyRef.current) return
    const n = clampPercent(Number(raw))
    const other = 100 - n
    if (changed === 'mc') {
      setMcWeight(String(n))
      setDiscursiveWeight(String(other))
    } else {
      setDiscursiveWeight(String(n))
      setMcWeight(String(other))
    }
    const timerKey = 'weight-pair'
    if (debounceTimers.current[timerKey]) clearTimeout(debounceTimers.current[timerKey])
    debounceTimers.current[timerKey] = setTimeout(() => {
      void (async () => {
        await persistKey('assessment.prova.mc_weight_percent', changed === 'mc' ? n : other)
        await persistKey(
          'assessment.prova.discursive_weight_percent',
          changed === 'mc' ? other : n
        )
      })()
    }, 500)
  }

  if (courseLoading || loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  const statusLabel =
    saveStatus === 'saving'
      ? 'Salvando…'
      : saveStatus === 'saved'
        ? 'Salvo automaticamente'
        : saveStatus === 'error'
          ? 'Erro ao salvar'
          : 'Alterações são salvas automaticamente'

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-secondary">
            Parâmetros da avaliação
          </h1>
          <p className="text-slate-500 mt-1">
            Regras do curso{' '}
            <strong className="text-secondary">
              {activeCourse?.name ?? 'ativo'}
            </strong>
            . Valem para a prova oficial e para o simulado.
          </p>
        </div>
        <p
          className={`text-sm ${
            saveStatus === 'error'
              ? 'text-red-600'
              : saveStatus === 'saving'
                ? 'text-amber-600'
                : saveStatus === 'saved'
                  ? 'text-green-600'
                  : 'text-slate-500'
          }`}
        >
          {statusLabel}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quantidade, tempo e nota</CardTitle>
          <CardDescription>
            Quantidade de perguntas objetivas e discursivas, tempo limite e nota mínima.
          </CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Perguntas de múltipla escolha"
            type="number"
            min={1}
            value={questionCount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setQuestionCount(e.target.value)
              scheduleSave('assessment.prova.question_count', e.target.value)
            }}
          />
          <Input
            label="Perguntas discursivas"
            type="number"
            min={0}
            value={discursiveCount}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setDiscursiveCount(e.target.value)
              scheduleSave('assessment.prova.discursive_count', e.target.value)
            }}
          />
          <Input
            label="Tempo limite (minutos)"
            type="number"
            min={1}
            value={timeLimitMinutes}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setTimeLimitMinutes(e.target.value)
              scheduleSave('assessment.prova.time_limit_minutes', e.target.value)
            }}
          />
          <Input
            label="Nota mínima para aprovação (%)"
            type="number"
            min={0}
            max={100}
            value={passingScore}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setPassingScore(e.target.value)
              scheduleSave('assessment.prova.passing_score', e.target.value)
            }}
          />
        </div>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Peso na nota final</CardTitle>
          <CardDescription>
            A soma dos pesos deve ser 100%. A nota final combina a média das objetivas e a
            média das discursivas conforme esses pesos.
          </CardDescription>
        </CardHeader>
        <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input
            label="Peso das múltiplas escolhas (%)"
            type="number"
            min={0}
            max={100}
            value={mcWeight}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              scheduleWeightPair('mc', e.target.value)
            }}
          />
          <Input
            label="Peso das discursivas (%)"
            type="number"
            min={0}
            max={100}
            value={discursiveWeight}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              scheduleWeightPair('discursive', e.target.value)
            }}
          />
          <p className="md:col-span-2 text-sm text-slate-500">
            Total: {clampPercent(Number(mcWeight)) + clampPercent(Number(discursiveWeight))}%
          </p>
        </div>
      </Card>
    </div>
  )
}
