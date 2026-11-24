'use client'

import Link from 'next/link'
import { Award, ChevronRight, PencilRuler } from 'lucide-react'

const LINKS = [
  {
    href: '/admin/certificados/modelo',
    title: 'Modelo do certificado',
    description:
      'Modelo único para todos os cursos: fundo, elementos e textos. Nome e carga do curso vêm dos dados de cada emissão.',
    icon: PencilRuler,
  },
  {
    href: '/admin/certificados/emitidos',
    title: 'Certificados emitidos',
    description:
      'Consulte, filtre por curso, visualize e baixe os certificados já gerados.',
    icon: Award,
  },
]

export default function AdminCertificadosHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Certificados</h1>
        <p className="text-gray-500 mt-1">
          Recurso do sistema: um modelo compartilhado e consulta de emissões com filtro por
          curso.
        </p>
      </div>

      <div className="grid w-full max-w-2xl grid-cols-1 auto-rows-fr gap-4">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="group flex h-full min-h-[8.5rem] w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-primary hover:shadow-md"
          >
            <div className="bg-sky-100 p-3 rounded-full group-hover:bg-sky-200 transition-colors shrink-0">
              <item.icon className="w-7 h-7 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-xl font-semibold text-secondary">{item.title}</h2>
                <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary shrink-0" />
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                {item.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
