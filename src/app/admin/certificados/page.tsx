'use client'

import Link from 'next/link'
import { Award, ChevronRight, PencilRuler } from 'lucide-react'

const LINKS = [
  {
    href: '/admin/certificados/modelo',
    title: 'Modelo do certificado',
    description: 'Edite o fundo, posicione elementos e altere os textos do certificado.',
    icon: PencilRuler,
  },
  {
    href: '/admin/certificados/emitidos',
    title: 'Certificados emitidos',
    description: 'Consulte, visualize e baixe os certificados já gerados para os alunos.',
    icon: Award,
  },
]

export default function AdminCertificadosHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Certificados</h1>
        <p className="text-gray-500 mt-1">
          Gerencie o modelo visual do certificado e a lista de emissões.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-2xl">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:border-primary hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="bg-sky-100 p-3 rounded-full group-hover:bg-sky-200 transition-colors shrink-0">
                <item.icon className="w-7 h-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold text-secondary">{item.title}</h2>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary shrink-0" />
                </div>
                <p className="text-sm text-gray-500 mt-1">{item.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
