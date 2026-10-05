'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { GraduationCap } from 'lucide-react'
import toast from 'react-hot-toast'
import CourseSwitcherMenu from '@/components/courses/CourseSwitcherMenu'

type Course = { id: string; name: string; slug: string }

type Props = {
  /** Variante mais larga para barra / menu mobile */
  variant?: 'compact' | 'bar'
}

export default function StudentCourseSwitcher({ variant = 'compact' }: Props) {
  const [courses, setCourses] = useState<Course[]>([])
  const [pendingCount, setPendingCount] = useState(0)
  const [activeId, setActiveId] = useState('')
  const [loading, setLoading] = useState(true)
  const [switching, setSwitching] = useState(false)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/student/courses', { cache: 'no-store' })
      if (!res.ok) return
      const data = await res.json()
      const active: Course[] = data.active ?? data.courses ?? []
      setCourses(active)
      const resolved =
        (typeof data.activeCourseId === 'string' && data.activeCourseId) ||
        active[0]?.id ||
        ''
      setActiveId(resolved)
      setPendingCount(Array.isArray(data.pending) ? data.pending.length : 0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const onChange = async (courseId: string) => {
    if (!courseId || courseId === activeId) return
    setActiveId(courseId)
    setSwitching(true)
    try {
      const res = await fetch('/api/student/courses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courseId }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Falha ao trocar curso')
      }
      window.location.reload()
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Não foi possível trocar o curso')
      void load()
      setSwitching(false)
    }
  }

  if (loading) return null

  if (courses.length === 0) {
    return (
      <Link
        href="/student/matriculas"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-950 bg-amber-100 border border-amber-300 rounded-lg px-2 py-1 hover:bg-amber-200"
      >
        <GraduationCap className="w-3.5 h-3.5 shrink-0" aria-hidden />
        {pendingCount > 0 ? 'Matrícula pendente' : 'Solicitar matrícula'}
      </Link>
    )
  }

  return (
    <CourseSwitcherMenu
      label={variant === 'bar' ? 'Curso' : 'Curso'}
      courses={courses}
      activeCourseId={activeId || courses[0].id}
      disabled={switching}
      size="sm"
      onSelect={(id) => void onChange(id)}
    />
  )
}
