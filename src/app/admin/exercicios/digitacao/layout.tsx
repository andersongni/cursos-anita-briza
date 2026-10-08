import { resolveAdminCourse, courseHasTypingExercise } from '@/lib/courses'
import { COURSE_FEATURES } from '@/lib/courses/capabilities'
import CourseFeatureUnavailable from '@/components/courses/CourseFeatureUnavailable'

export const dynamic = 'force-dynamic'

export default async function AdminDigitacaoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const course = await resolveAdminCourse()
  if (!courseHasTypingExercise(course.slug)) {
    return (
      <CourseFeatureUnavailable
        featureLabel={COURSE_FEATURES.typing_exercise.label}
        courseName={course.name}
        backHref="/admin/dashboard"
        backLabel="Voltar ao painel"
      />
    )
  }
  return children
}
