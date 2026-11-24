'use client'

import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'

export default function AdminPrecisaoDoMouseHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/exercicios"
          className="inline-flex items-center text-sm text-accent hover:text-secondary mb-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar aos exercícios
        </Link>
        <h1 className="text-3xl font-bold text-secondary">Precisão do mouse</h1>
        <p className="text-gray-500 mt-1">
          Consulte o ranking completo das partidas dos alunos.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        <Link
          href="/admin/exercicios/precisao-do-mouse/ranking"
          className="group bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="bg-amber-50 p-3 rounded-full group-hover:bg-amber-100 transition-colors">
              <Trophy className="w-7 h-7 text-brand-gold-dark" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-secondary">Ranking</h2>
              <p className="text-sm text-gray-500 mt-1">
                Veja o ranking completo de todas as partidas, com nota, acertos e precisão.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
