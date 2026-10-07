'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import DiscursiveCriteriaEditor from '@/components/admin/DiscursiveCriteriaEditor'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import toast from 'react-hot-toast'
import { useAdminCourse } from '@/components/courses/AdminCourseProvider'

function safeReturnTo(raw: string | null): string {
  if (!raw || !raw.startsWith('/admin/')) return '/admin/perguntas'
  return raw
}

type Dimension = { id: string; name: string }

const emptyForm = {
  tipo: 'PROVA',
  formato: 'MULTIPLE_CHOICE' as 'MULTIPLE_CHOICE' | 'DISCURSIVE',
  tema: '',
  pergunta: '',
  expectedAnswer: '',
  altA: '',
  expA: '',
  altB: '',
  expB: '',
  altC: '',
  expC: '',
  altD: '',
  expD: '',
  altE: '',
  expE: '',
  correta: 'A',
  expCorreta: '',
  ativa: true,
}

function NovaPerguntaContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get('returnTo')),
    [searchParams]
  )
  const prefillDimensionId = searchParams.get('dimension_id') || ''
  const { activeCourse, activeCourseId, loading: courseLoading } = useAdminCourse()
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [loadingDims, setLoadingDims] = useState(true)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState(emptyForm)

  useEffect(() => {
    if (courseLoading || !activeCourseId) return

    let cancelled = false
    const load = async () => {
      setLoadingDims(true)
      try {
        const res = await fetch(
          `/api/admin/dimensions?courseId=${encodeURIComponent(activeCourseId)}`,
          { cache: 'no-store' }
        )
        if (!res.ok) throw new Error('Falha ao carregar temas')
        const data = await res.json()
        if (cancelled) return
        const dims: Dimension[] = data.dimensions ?? []
        setDimensions(dims)
        const tema =
          prefillDimensionId && dims.some((d) => d.id === prefillDimensionId)
            ? prefillDimensionId
            : ''
        setFormData((prev) => ({ ...prev, tema }))
      } catch {
        if (!cancelled) {
          toast.error('Erro ao carregar temas do curso')
          setDimensions([])
        }
      } finally {
        if (!cancelled) setLoadingDims(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [activeCourseId, courseLoading, prefillDimensionId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.tema || !formData.pergunta) {
      toast.error('Preencha os campos obrigatórios.')
      return
    }
    if (formData.formato === 'DISCURSIVE' && !formData.expectedAnswer.trim()) {
      toast.error('Informe a resposta de referência para correção da discursiva.')
      return
    }
    if (
      formData.formato === 'MULTIPLE_CHOICE' &&
      (!formData.altA || !formData.altB)
    ) {
      toast.error('Preencha pelo menos as alternativas A e B.')
      return
    }
    if (!activeCourseId) {
      toast.error('Selecione um curso no topo da página.')
      return
    }

    setSaving(true)
    try {
      const keys = ['A', 'B', 'C', 'D', 'E'] as const
      const texts = [formData.altA, formData.altB, formData.altC, formData.altD, formData.altE]
      const exps = [formData.expA, formData.expB, formData.expC, formData.expD, formData.expE]
      const options =
        formData.formato === 'MULTIPLE_CHOICE'
          ? keys.map((key, i) => ({
              option_key: key,
              option_text: texts[i],
              is_correct: formData.correta === key,
              explanation:
                formData.correta === key
                  ? formData.expCorreta || exps[i] || ''
                  : exps[i] || '',
            }))
          : undefined

      const res = await fetch('/api/admin/questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          courseId: activeCourseId,
          type: formData.tipo,
          format: formData.formato,
          dimension_id: formData.tema,
          question_text: formData.pergunta,
          expected_answer:
            formData.formato === 'DISCURSIVE' ? formData.expectedAnswer : undefined,
          active: formData.ativa,
          options,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar pergunta')
      toast.success('Pergunta salva com sucesso!')
      router.push(returnTo)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao salvar pergunta')
    } finally {
      setSaving(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    const checked = type === 'checkbox' ? (e.target as HTMLInputElement).checked : undefined
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }))
  }

  if (courseLoading || loadingDims) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Nova Pergunta</h1>
          {activeCourse?.name ? (
            <p className="text-sm text-slate-500 mt-1">
              Curso: <strong>{activeCourse.name}</strong>
            </p>
          ) : null}
        </div>
        <Link href={returnTo}>
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      {dimensions.length === 0 ? (
        <Card>
          <div className="p-6 space-y-3">
            <p className="text-slate-700">
              Não há temas cadastrados para{' '}
              <strong>{activeCourse?.name ?? 'este curso'}</strong>. Cadastre temas em Temas
              antes de criar perguntas.
            </p>
            <Link href="/admin/temas">
              <Button variant="primary">Ir para Temas</Button>
            </Link>
          </div>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Dados Básicos</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Tipo de Avaliação"
                name="tipo"
                value={formData.tipo}
                onChange={handleChange}
                options={[
                  { value: 'PROVA', label: 'Prova' },
                  { value: 'SIMULADO', label: 'Simulado' },
                ]}
              />
              <Select
                label="Formato"
                name="formato"
                value={formData.formato}
                onChange={handleChange}
                options={[
                  { value: 'MULTIPLE_CHOICE', label: 'Múltipla escolha' },
                  { value: 'DISCURSIVE', label: 'Discursiva' },
                ]}
              />
              <Select
                label="Tema"
                name="tema"
                value={formData.tema}
                onChange={handleChange}
                options={[
                  { value: '', label: 'Selecione...' },
                  ...dimensions.map((d) => ({ value: d.id, label: d.name })),
                ]}
              />
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Enunciado da Pergunta *
                </label>
                <textarea
                  name="pergunta"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-h-[100px]"
                  value={formData.pergunta}
                  onChange={handleChange}
                  required
                />
              </div>
              <div className="md:col-span-2 flex items-center mt-2">
                <input
                  type="checkbox"
                  name="ativa"
                  id="ativa"
                  checked={formData.ativa}
                  onChange={handleChange}
                  className="mr-2"
                />
                <label htmlFor="ativa" className="text-sm font-medium text-gray-700">
                  Pergunta Ativa (disponível para sorteio)
                </label>
              </div>
            </div>
          </Card>

          {formData.formato === 'DISCURSIVE' ? (
            <Card>
              <CardHeader>
                <CardTitle>Correção da discursiva</CardTitle>
              </CardHeader>
              <div className="p-4 pt-0 space-y-3">
                <p className="text-sm text-slate-500">
                  Oriente a IA sobre o que considerar correto. A correção interpreta o
                  sentido da resposta (não é só busca por palavras-chave). Use
                  &quot;Incrementar com IA&quot; para ampliar critérios, faixas de nota e
                  exemplos.
                </p>
                <DiscursiveCriteriaEditor
                  questionText={formData.pergunta}
                  courseName={activeCourse?.name}
                  themeName={
                    dimensions.find((d) => d.id === formData.tema)?.name ?? null
                  }
                  assessmentType={formData.tipo}
                  value={formData.expectedAnswer}
                  onChange={(expectedAnswer) =>
                    setFormData((f) => ({ ...f, expectedAnswer }))
                  }
                  placeholder="Ex.: Aceitar exemplos válidos e rejeitar confusões comuns..."
                  required
                />
              </div>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Alternativas</CardTitle>
              </CardHeader>
              <div className="p-4 pt-0 space-y-6">
                <div className="md:w-1/3">
                  <Select
                    label="Alternativa Correta *"
                    name="correta"
                    value={formData.correta}
                    onChange={handleChange}
                    options={[
                      { value: 'A', label: 'A' },
                      { value: 'B', label: 'B' },
                      { value: 'C', label: 'C' },
                      { value: 'D', label: 'D' },
                      { value: 'E', label: 'E' },
                    ]}
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Explicação Geral (mostrada quando acerta)
                  </label>
                  <textarea
                    name="expCorreta"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[60px]"
                    value={formData.expCorreta}
                    onChange={handleChange}
                  />
                </div>

                {(['A', 'B', 'C', 'D', 'E'] as const).map((letra) => (
                  <div
                    key={letra}
                    className={`p-4 border rounded-md ${
                      formData.correta === letra
                        ? 'border-green-300 bg-green-50'
                        : 'border-gray-200'
                    }`}
                  >
                    <div className="flex items-center mb-2">
                      <span
                        className={`font-bold mr-2 ${
                          formData.correta === letra ? 'text-green-600' : 'text-gray-700'
                        }`}
                      >
                        Alternativa {letra} {formData.correta === letra && '(Correta)'}
                      </span>
                    </div>
                    <div className="space-y-4">
                      <Input
                        label="Texto da Alternativa *"
                        name={`alt${letra}`}
                        value={formData[`alt${letra}` as keyof typeof formData] as string}
                        onChange={handleChange}
                        required={letra === 'A' || letra === 'B'}
                      />
                      <div className="mt-2">
                        <label className="block text-xs text-gray-500 mb-1">
                          Explicação específica (opcional, mostrada se aluno errar escolhendo esta)
                        </label>
                        <textarea
                          name={`exp${letra}`}
                          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[50px]"
                          value={formData[`exp${letra}` as keyof typeof formData] as string}
                          onChange={handleChange}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          <div className="flex justify-end space-x-4">
            <Link href={returnTo}>
              <Button variant="outline" type="button">
                Cancelar
              </Button>
            </Link>
            <Button variant="primary" type="submit" loading={saving}>
              Salvar Pergunta
            </Button>
          </div>
        </form>
      )}
    </div>
  )
}

export default function NovaPerguntaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <NovaPerguntaContent />
    </Suspense>
  )
}
