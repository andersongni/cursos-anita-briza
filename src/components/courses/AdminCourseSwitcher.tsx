'use client'

import { useAdminCourse } from '@/components/courses/AdminCourseProvider'
import CourseSwitcherMenu from '@/components/courses/CourseSwitcherMenu'

export default function AdminCourseSwitcher() {
  const { courses, activeCourseId, loading, setActiveCourseId } = useAdminCourse()

  if (loading || courses.length === 0) return null

  return (
    <CourseSwitcherMenu
      label="Curso ativo"
      courses={courses}
      activeCourseId={activeCourseId}
      onSelect={(id) => void setActiveCourseId(id)}
    />
  )
}
