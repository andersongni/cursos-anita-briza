'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { usePathname, useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import {
  courseHasStudentExercises,
  courseHasTypingExercise,
  listCourseFeatures,
  type CourseFeatureId,
} from '@/lib/courses/capabilities'

export type AdminCourse = {
  id: string
  name: string
  slug: string
  description?: string | null
  hours?: number
  active?: boolean
}

type AdminCourseContextValue = {
  courses: AdminCourse[]
  activeCourse: AdminCourse | null
  activeCourseId: string
  features: CourseFeatureId[]
  hasExercises: boolean
  hasTypingExercise: boolean
  loading: boolean
  setActiveCourseId: (courseId: string) => Promise<void>
  reload: () => Promise<void>
}

const AdminCourseContext = createContext<AdminCourseContextValue | null>(null)

export function AdminCourseProvider({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [activeCourseId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/courses', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      setCourses(data.courses ?? [])
      setActiveId(data.activeCourseId ?? data.activeCourse?.id ?? '')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
  }, [reload, pathname])

  const setActiveCourseId = useCallback(
    async (courseId: string) => {
      setActiveId(courseId)
      try {
        const res = await fetch('/api/admin/courses', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ courseId }),
        })
        if (!res.ok) throw new Error('Falha ao trocar curso')
        router.refresh()
        window.location.reload()
      } catch {
        toast.error('Não foi possível trocar o curso')
        void reload()
      }
    },
    [reload, router]
  )

  const activeCourse =
    courses.find((c) => c.id === activeCourseId) ?? courses[0] ?? null
  const slug = activeCourse?.slug ?? null
  const features = useMemo(() => listCourseFeatures(slug), [slug])
  const hasExercises = courseHasStudentExercises(slug)
  const hasTypingExercise = courseHasTypingExercise(slug)

  const value = useMemo<AdminCourseContextValue>(
    () => ({
      courses,
      activeCourse,
      activeCourseId: activeCourse?.id ?? activeCourseId,
      features,
      hasExercises,
      hasTypingExercise,
      loading,
      setActiveCourseId,
      reload,
    }),
    [
      courses,
      activeCourse,
      activeCourseId,
      features,
      hasExercises,
      hasTypingExercise,
      loading,
      setActiveCourseId,
      reload,
    ]
  )

  return (
    <AdminCourseContext.Provider value={value}>{children}</AdminCourseContext.Provider>
  )
}

export function useAdminCourse(): AdminCourseContextValue {
  const ctx = useContext(AdminCourseContext)
  if (!ctx) {
    throw new Error('useAdminCourse deve ser usado dentro de AdminCourseProvider')
  }
  return ctx
}
