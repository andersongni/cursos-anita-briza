import {
  resolveAdminCourse,
  courseHasMouseAccuracyExercise,
} from '@/lib/courses'
import { COURSE_FEATURES } from '@/lib/courses/capabilities'
import CourseFeatureUnavailable from '@/components/courses/CourseFeatureUnavailable'

export const dynamic = 'force-dynamic'

export default async function AdminPrecisaoDoMouseLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const course = await resolveAdminCourse()
  if (!courseHasMouseAccuracyExercise(course.slug)) {
    return (
      <CourseFeatureUnavailable
        featureLabel={COURSE_FEATURES.mouse_accuracy_exercise.label}
        courseName={course.name}
        backHref="/admin/dashboard"
        backLabel="Voltar ao painel"
      />
    )
  }
  return children
}
