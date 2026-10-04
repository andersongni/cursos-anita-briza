'use client'

import { useState } from 'react'
import Input from '@/components/ui/Input'
import Button from '@/components/ui/Button'
import toast from 'react-hot-toast'

type Props = {
  onSubmitted?: () => void
}

export default function FeedbackForm({ onSubmitted }: Props) {
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject: subject.trim() || undefined,
          message: message.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Erro ao enviar feedback')
      toast.success('Feedback enviado. Obrigado!')
      setSubject('')
      setMessage('')
      onSubmitted?.()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Erro ao enviar feedback')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Input
        label="Assunto (opcional)"
        value={subject}
        maxLength={120}
        placeholder="Ex.: Dificuldade na prova, sugestão de melhoria..."
        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSubject(e.target.value)}
      />

      <div className="w-full">
        <label htmlFor="feedback-message" className="block text-sm font-medium text-foreground mb-1">
          Mensagem<span className="text-error ml-1">*</span>
        </label>
        <textarea
          id="feedback-message"
          required
          rows={5}
          maxLength={2000}
          value={message}
          placeholder="Conte o que achou da plataforma, dúvidas ou problemas encontrados."
          onChange={(e) => setMessage(e.target.value)}
          className="w-full px-3 py-2 border border-border rounded-lg text-foreground bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary placeholder:text-muted-foreground"
        />
        <p className="mt-1 text-xs text-muted-foreground">{message.length}/2000</p>
      </div>

      <div className="flex justify-end">
        <Button type="submit" loading={submitting} disabled={!message.trim()}>
          Enviar feedback
        </Button>
      </div>
    </form>
  )
}
