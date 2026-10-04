'use client'

import Link from 'next/link'
import { MessageSquarePlus, MessagesSquare } from 'lucide-react'

export default function AdminFeedbackHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Feedbacks</h1>
        <p className="text-gray-500 mt-1">Escolha se deseja escrever ou consultar os feedbacks.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        <Link
          href="/admin/feedback/escrever"
          className="group bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="bg-sky-100 p-3 rounded-full group-hover:bg-sky-200 transition-colors">
              <MessageSquarePlus className="w-7 h-7 text-sky-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-secondary">Escrever</h2>
              <p className="text-sm text-gray-500 mt-1">
                Registre um novo feedback como administrador.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/feedback/consultar"
          className="group bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="bg-emerald-100 p-3 rounded-full group-hover:bg-emerald-200 transition-colors">
              <MessagesSquare className="w-7 h-7 text-emerald-700" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-secondary">Consultar</h2>
              <p className="text-sm text-gray-500 mt-1">
                Veja as mensagens enviadas por alunos e administradores.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
