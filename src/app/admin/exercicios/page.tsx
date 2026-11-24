'use client'

import Link from 'next/link'
import { Keyboard, MousePointer2, ChevronRight } from 'lucide-react'
import { useAdminCourse } from '@/components/courses/AdminCourseProvider'
import CourseFeatureUnavailable from '@/components/courses/CourseFeatureUnavailable'
import Spinner from '@/components/ui/Spinner'
import { COURSE_FEATURES } from '@/lib/courses/capabilities'

const EXERCISES = [
  {
    feature: 'typing_exercise' as const,
    href: '/admin/exercicios/digitacao',
    title: COURSE_FEATURES.typing_exercise.label,
    description:
      'Gerencie os textos da pista de prática e acompanhe o ranking completo das tentativas dos alunos.',
    icon: Keyboard,
  },
  {
    feature: 'mouse_accuracy_exercise' as const,
    href: '/admin/exercicios/precisao-do-mouse',
    title: COURSE_FEATURES.mouse_accuracy_exercise.label,
    description:
      'Acompanhe o ranking completo das partidas de precisão do mouse dos alunos.',
    icon: MousePointer2,
  },
]

export default function AdminExerciciosHubPage() {
  const { activeCourse, hasExercises, loading, features } = useAdminCourse()

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <Spinner size="lg" />
      </div>
    )
  }

  if (!hasExercises) {
    return (
      <CourseFeatureUnavailable
        featureLabel="Exercícios"
        courseName={activeCourse?.name}
        backHref="/admin/dashboard"
      />
    )
  }

  const visible = EXERCISES.filter((ex) => features.includes(ex.feature))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-secondary">Exercícios</h1>
        <p className="text-gray-500 mt-1">
          Recursos do curso {activeCourse?.name ?? 'ativo'}. Escolha um exercício para
          administrar textos, configurações ou resultados.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-slate-600">Nenhum exercício configurado para este curso.</p>
      ) : (
        <div className="grid w-full max-w-2xl grid-cols-1 auto-rows-fr gap-4">
          {visible.map((exercise) => (
            <Link
              key={exercise.href}
              href={exercise.href}
              className="group flex h-full min-h-[8.5rem] w-full items-center gap-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm transition-all hover:border-primary hover:shadow-md"
            >
              <div className="bg-sky-100 p-3 rounded-full group-hover:bg-sky-200 transition-colors shrink-0">
                <exercise.icon className="w-7 h-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-xl font-semibold text-secondary">
                    {exercise.title}
                  </h2>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-primary shrink-0" />
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-gray-500">
                  {exercise.description}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
