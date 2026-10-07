'use client'

import { Suspense, useState, useEffect, useMemo } from 'react'
import Card, { CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Select from '@/components/ui/Select'
import Spinner from '@/components/ui/Spinner'
import DiscursiveCriteriaEditor from '@/components/admin/DiscursiveCriteriaEditor'
import Link from 'next/link'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
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
  ativa: true,
}

function EditarPerguntaContent() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const returnTo = useMemo(
    () => safeReturnTo(searchParams.get('returnTo')),
    [searchParams]
  )
  const { activeCourseId, activeCourse, loading: courseLoading } = useAdminCourse()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dimensions, setDimensions] = useState<Dimension[]>([])
  const [formData, setFormData] = useState(emptyForm)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (courseLoading || !activeCourseId) return

    const load = async () => {
      try {
        const [qRes, dRes] = await Promise.all([
          fetch(`/api/admin/questions/${params.id}`),
          fetch(`/api/admin/dimensions?courseId=${encodeURIComponent(activeCourseId)}`, {
            cache: 'no-store',
          }),
        ])
        if (dRes.ok) {
          const dData = await dRes.json()
          setDimensions(dData.dimensions ?? [])
        }
        if (!qRes.ok) {
          setNotFound(true)
          return
        }
        const { question } = await qRes.json()
        const opts = question.options ?? []
        const byKey = (k: string) => opts.find((o: any) => o.option_key?.toUpperCase() === k)
        const correct = opts.find((o: any) => o.is_correct)?.option_key?.toUpperCase() || 'A'
        setFormData({
          tipo: question.type,
          formato:
            question.format === 'DISCURSIVE' ? 'DISCURSIVE' : 'MULTIPLE_CHOICE',
          tema: question.dimension_id,
          pergunta: question.question_text,
          expectedAnswer: question.expected_answer ?? '',
          altA: byKey('A')?.option_text ?? '',
          expA: byKey('A')?.explanation ?? '',
          altB: byKey('B')?.option_text ?? '',
          expB: byKey('B')?.explanation ?? '',
          altC: byKey('C')?.option_text ?? '',
          expC: byKey('C')?.explanation ?? '',
          altD: byKey('D')?.option_text ?? '',
          expD: byKey('D')?.explanation ?? '',
          altE: byKey('E')?.option_text ?? '',
          expE: byKey('E')?.explanation ?? '',
          correta: correct,
          ativa: question.active,
        })
      } catch {
        toast.error('Erro ao carregar pergunta')
        setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [params.id, activeCourseId, courseLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (formData.formato === 'DISCURSIVE' && !formData.expectedAnswer.trim()) {
      toast.error('Informe a resposta de referência para correção da discursiva.')
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
              explanation: exps[i] || '',
            }))
          : []

      const res = await fetch(`/api/admin/questions/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: formData.tipo,
          format: formData.formato,
          dimension_id: formData.tema,
          question_text: formData.pergunta,
          expected_answer:
            formData.formato === 'DISCURSIVE' ? formData.expectedAnswer : null,
          active: formData.ativa,
          options,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar')
      toast.success('Pergunta atualizada com sucesso!')
      router.push(returnTo)
    } catch (err: any) {
      toast.error(err.message)
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

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-gray-500">Pergunta não encontrada.</p>
        <Link href={returnTo}>
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center gap-3 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Editar Pergunta</h1>
          {activeCourse?.name ? (
            <p className="text-sm text-slate-500 mt-1">
              Temas do curso: <strong>{activeCourse.name}</strong>
            </p>
          ) : null}
        </div>
        <Link href={returnTo}>
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

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
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[100px]"
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
                required
              />
            </div>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Alternativas</CardTitle>
            </CardHeader>
            <div className="p-4 pt-0 space-y-4">
              {(['A', 'B', 'C', 'D', 'E'] as const).map((key) => (
                <div key={key} className="grid grid-cols-1 md:grid-cols-2 gap-3 border-b pb-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Alternativa {key}</label>
                    <input
                      name={`alt${key}`}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={(formData as any)[`alt${key}`]}
                      onChange={handleChange}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Explicação {key}</label>
                    <input
                      name={`exp${key}`}
                      className="w-full border rounded-md px-3 py-2 text-sm"
                      value={(formData as any)[`exp${key}`]}
                      onChange={handleChange}
                    />
                  </div>
                </div>
              ))}
              <Select
                label="Alternativa correta"
                name="correta"
                value={formData.correta}
                onChange={handleChange}
                options={['A', 'B', 'C', 'D', 'E'].map((v) => ({ value: v, label: v }))}
              />
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
            Atualizar Pergunta
          </Button>
        </div>
      </form>
    </div>
  )
}

export default function EditarPerguntaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center p-12">
          <Spinner size="lg" />
        </div>
      }
    >
      <EditarPerguntaContent />
    </Suspense>
  )
}
