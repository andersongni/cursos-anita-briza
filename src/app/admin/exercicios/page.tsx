'use client'

import Link from 'next/link'
import { Keyboard, ChevronRight } from 'lucide-react'

const EXERCISES = [
  {
    href: '/admin/exercicios/digitacao',
    title: 'Prática de digitação',
    description:
      'Gerencie os textos da pista de prática e acompanhe o ranking completo das tentativas dos alunos.',
    icon: Keyboard,
  },
]

export default function AdminExerciciosHubPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Exercícios</h1>
        <p className="text-gray-500 mt-1">
          Escolha um exercício para administrar textos, configurações ou resultados.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 max-w-2xl">
        {EXERCISES.map((exercise) => (
          <Link
            key={exercise.href}
            href={exercise.href}
            className="group bg-white rounded-lg shadow-sm border border-slate-200 p-6 hover:border-primary hover:shadow-md transition-all"
          >
            <div className="flex items-start gap-4">
              <div className="bg-sky-100 p-3 rounded-full group-hover:bg-sky-200 transition-colors shrink-0">
                <exercise.icon className="w-7 h-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold text-secondary">{exercise.title}</h2>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary shrink-0" />
                </div>
                <p className="text-sm text-gray-500 mt-1">{exercise.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
