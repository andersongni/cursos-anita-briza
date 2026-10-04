'use client'

import Link from 'next/link'
import { Keyboard, ChevronRight } from 'lucide-react'
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'

const EXERCISES = [
  {
    href: '/student/exercicios/digitacao',
    title: 'Prática de digitação',
    description:
      'Treine velocidade e precisão em português, no estilo de uma pista de prática. Sem limite de tempo — ao terminar, veja sua nota e o ranking.',
    icon: Keyboard,
  },
]

export default function StudentExerciciosPage() {
  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Exercícios</h1>
        <p className="text-slate-600 mt-2">
          Práticas extras para desenvolver habilidades do dia a dia no computador.
        </p>
      </div>

      <div className="space-y-4">
        {EXERCISES.map((exercise) => (
          <Card key={exercise.href} className="border-t-4 border-t-primary hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start gap-4">
                <div className="bg-sky-100 p-3 rounded-full shrink-0">
                  <exercise.icon className="w-7 h-7 text-primary" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-xl text-secondary">{exercise.title}</CardTitle>
                  <CardDescription className="mt-2 text-base text-slate-600">
                    {exercise.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-2 flex justify-end">
              <Link href={exercise.href}>
                <Button variant="primary">
                  Começar
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
