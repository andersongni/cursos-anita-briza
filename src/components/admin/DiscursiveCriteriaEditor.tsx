'use client'

import { useState } from 'react'
import Button from '@/components/ui/Button'
import { Sparkles, Undo2 } from 'lucide-react'
import toast from 'react-hot-toast'

type Props = {
  questionText: string
  courseName?: string | null
  themeName?: string | null
  assessmentType?: string | null
  value: string
  onChange: (value: string) => void
  name?: string
  required?: boolean
  placeholder?: string
}

export default function DiscursiveCriteriaEditor({
  questionText,
  courseName,
  themeName,
  assessmentType,
  value,
  onChange,
  name = 'expectedAnswer',
  required,
  placeholder,
}: Props) {
  const [expanding, setExpanding] = useState(false)
  const [originalBeforeAi, setOriginalBeforeAi] = useState<string | null>(null)

  const handleExpand = async () => {
    if (!questionText.trim()) {
      toast.error('Preencha o enunciado da pergunta antes')
      return
    }
    if (!value.trim()) {
      toast.error('Escreva algum critério antes de incrementar com IA')
      return
    }

    setExpanding(true)
    try {
      const res = await fetch('/api/admin/questions/expand-criteria', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: questionText.trim(),
          criteria: value.trim(),
          courseName: courseName?.trim() || null,
          themeName: themeName?.trim() || null,
          assessmentType: assessmentType?.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Falha ao elaborar critérios')

      const next = typeof data.criteria === 'string' ? data.criteria.trim() : ''
      if (!next) throw new Error('Resposta vazia da IA')

      // Guarda o texto de antes desta expansão (não sobrescreve se já houver rascunho)
      setOriginalBeforeAi((prev) => (prev == null ? value : prev))
      onChange(next)
      toast.success('Critérios elaborados. Revise e salve a pergunta, ou reverta.')
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Erro ao incrementar com IA')
    } finally {
      setExpanding(false)
    }
  }

  const handleRevert = () => {
    if (originalBeforeAi == null) return
    onChange(originalBeforeAi)
    setOriginalBeforeAi(null)
    toast.success('Texto original restaurado')
  }

  const handleKeep = () => {
    setOriginalBeforeAi(null)
    toast.success('Critérios mantidos. Não esqueça de salvar a pergunta.')
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="block text-sm font-medium text-gray-700">
          Critérios para a IA {required ? '*' : null}
        </label>
        <Button
          type="button"
          variant="outline"
          size="sm"
          loading={expanding}
          onClick={() => void handleExpand()}
          disabled={expanding}
        >
          <Sparkles className="w-4 h-4 mr-1.5" />
          Incrementar com IA
        </Button>
      </div>

      <textarea
        name={name}
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm min-h-[160px]"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />

      {originalBeforeAi != null && (
        <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-3 text-sm text-sky-950 space-y-2">
          <p>
            A IA elaborou uma versão ampliada dos critérios. Você pode{' '}
            <strong>manter</strong> este texto e salvar a pergunta, ou{' '}
            <strong>reverter</strong> ao texto de antes.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="primary" onClick={handleKeep}>
              Manter este texto
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={handleRevert}>
              <Undo2 className="w-4 h-4 mr-1.5" />
              Reverter ao original
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
