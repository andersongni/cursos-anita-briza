'use client'

import { MessageSquare } from 'lucide-react'
import FeedbackForm from '@/components/feedback/FeedbackForm'

export default function StudentFeedbackPage() {
  return (
    <div className="max-w-2xl mx-auto py-8 px-4 space-y-8">
      <div className="flex items-center gap-4 border-b border-slate-200 pb-6">
        <div className="bg-sky-100 p-3 rounded-full">
          <MessageSquare className="w-8 h-8 text-sky-700" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-slate-800">Feedback</h1>
          <p className="text-slate-500 mt-1">
            Envie sugestões, dúvidas ou relatos de problemas. Somente a administração visualiza as
            mensagens.
          </p>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <FeedbackForm />
      </div>
    </div>
  )
}
