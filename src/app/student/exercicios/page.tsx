'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Keyboard, ChevronRight } from 'lucide-react'
import Card, { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card'
import Button from '@/components/ui/Button'
import Spinner from '@/components/ui/Spinner'
import { COURSE_FEATURES } from '@/lib/courses/capabilities'

const EXERCISES = [
  {
    feature: 'typing_exercise' as const,
    href: '/student/exercicios/digitacao',
    title: COURSE_FEATURES.typing_exercise.label,
    description:
      'Treine velocidade e precisão em português, no estilo de uma pista de prática. Sem limite de tempo — ao terminar, veja sua nota e o ranking.',
    icon: Keyboard,
  },
]

export default function StudentExerciciosPage() {
  const [loading, setLoading] = useState(true)
  const [hasExercises, setHasExercises] = useState(false)
  const [courseName, setCourseName] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/student/courses', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        setHasExercises(Boolean(data.activeCourseHasExercises))
        setCourseName(
          typeof data.activeCourse?.name === 'string' ? data.activeCourse.name : null
        )
      } finally {
        setLoading(false)
      }
    }
    void load()
  }, [])

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!hasExercises) {
    return (
      <div className="max-w-3xl mx-auto py-8 px-4 space-y-4">
        <h1 className="text-3xl font-bold text-secondary">Exercícios</h1>
        <Card>
          <CardContent className="p-6 space-y-3">
            <p className="text-slate-700">
              Não há exercícios disponíveis
              {courseName ? (
                <>
                  {' '}
                  para o curso <strong>{courseName}</strong>
                </>
              ) : null}
              . Troque o curso em uso ou solicite matrícula em um curso que ofereça práticas.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href="/dashboard">
                <Button variant="outline">Voltar ao início</Button>
              </Link>
              <Link href="/student/matriculas">
                <Button variant="primary">Ver matrículas</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Exercícios</h1>
        <p className="text-slate-600 mt-2">
          Práticas extras{courseName ? ` do curso ${courseName}` : ''}.
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
