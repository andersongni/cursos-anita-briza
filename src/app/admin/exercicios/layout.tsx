import { resolveAdminCourse, courseHasStudentExercises } from '@/lib/courses'
import CourseFeatureUnavailable from '@/components/courses/CourseFeatureUnavailable'

export const dynamic = 'force-dynamic'

/**
 * Gate server-side: rotas de exercícios só existem para cursos com features
 * registradas em `lib/courses/capabilities`.
 */
export default async function AdminExerciciosLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const course = await resolveAdminCourse()
  if (!courseHasStudentExercises(course.slug)) {
    return (
      <CourseFeatureUnavailable
        featureLabel="Exercícios"
        courseName={course.name}
        backHref="/admin/dashboard"
        backLabel="Voltar ao painel"
      />
    )
  }
  return children
}
