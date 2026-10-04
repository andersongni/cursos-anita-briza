'use client'

import Link from 'next/link'
import Button from '@/components/ui/Button'
import FeedbackForm from '@/components/feedback/FeedbackForm'

export default function AdminFeedbackEscreverPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-secondary">Escrever feedback</h1>
          <p className="text-gray-500 mt-1">Envie uma mensagem para o registro de feedbacks.</p>
        </div>
        <Link href="/admin/feedback">
          <Button variant="outline">Voltar</Button>
        </Link>
      </div>

      <div className="bg-white p-6 rounded-lg shadow-sm">
        <FeedbackForm />
      </div>
    </div>
  )
}
