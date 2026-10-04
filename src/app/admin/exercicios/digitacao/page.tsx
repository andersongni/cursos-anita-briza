'use client'

import Link from 'next/link'
import { ArrowLeft, FileText, Trophy } from 'lucide-react'

export default function AdminDigitacaoHubPage() {
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
        <h1 className="text-3xl font-bold text-secondary">Prática de digitação</h1>
        <p className="text-gray-500 mt-1">
          Escolha se deseja gerenciar os textos ou consultar o ranking das práticas.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-3xl">
        <Link
          href="/admin/exercicios/digitacao/textos"
          className="group bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="bg-sky-100 p-3 rounded-full group-hover:bg-sky-200 transition-colors">
              <FileText className="w-7 h-7 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-secondary">Textos</h2>
              <p className="text-sm text-gray-500 mt-1">
                Crie, edite, ative ou desative os textos usados na prática dos alunos.
              </p>
            </div>
          </div>
        </Link>

        <Link
          href="/admin/exercicios/digitacao/ranking"
          className="group bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:border-primary hover:shadow-md transition-all"
        >
          <div className="flex items-start gap-4">
            <div className="bg-amber-50 p-3 rounded-full group-hover:bg-amber-100 transition-colors">
              <Trophy className="w-7 h-7 text-brand-gold-dark" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-secondary">Ranking</h2>
              <p className="text-sm text-gray-500 mt-1">
                Veja o ranking completo de todas as tentativas, com data, tempo e nota.
              </p>
            </div>
          </div>
        </Link>
      </div>
    </div>
  )
}
