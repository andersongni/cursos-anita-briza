'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, GraduationCap } from 'lucide-react'

export type CourseSwitcherItem = {
  id: string
  name: string
}

type Props = {
  label: string
  courses: CourseSwitcherItem[]
  activeCourseId: string
  disabled?: boolean
  /** Largura/ênfase do gatilho */
  size?: 'sm' | 'md'
  onSelect: (courseId: string) => void
}

/**
 * Seletor de curso com lista customizada (mesma identidade visual do bloco ativo).
 */
export default function CourseSwitcherMenu({
  label,
  courses,
  activeCourseId,
  disabled = false,
  size = 'sm',
  onSelect,
}: Props) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listId = useId()
  const active = courses.find((c) => c.id === activeCourseId) ?? courses[0]
  const name = active?.name ?? 'Curso'

  useEffect(() => {
    if (!open) return
    const onPointer = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const isMd = size === 'md'
  const triggerText = isMd ? 'text-base font-bold' : 'text-xs sm:text-sm font-bold'
  const iconBox = isMd
    ? 'flex h-9 w-9 rounded-lg'
    : 'flex h-7 w-7 rounded-md'

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled || courses.length <= 1}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => {
          if (courses.length <= 1 || disabled) return
          setOpen((v) => !v)
        }}
        className={`flex w-full items-center gap-1.5 sm:gap-2 min-w-0 rounded-lg border border-primary/35 bg-sky-50 px-2 py-1 text-left transition-colors ${
          courses.length > 1 && !disabled
            ? 'hover:border-primary/55 hover:bg-sky-100/80 cursor-pointer'
            : 'cursor-default'
        } ${open ? 'border-primary ring-2 ring-primary/20' : ''} disabled:opacity-70`}
        title={`${label}: ${name}`}
      >
        <div
          className={`${iconBox} shrink-0 items-center justify-center bg-primary text-white`}
        >
          <GraduationCap className={isMd ? 'h-4 w-4' : 'h-3.5 w-3.5'} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[9px] font-semibold uppercase tracking-wide text-primary leading-none mb-0.5">
            {label}
          </p>
          <p className={`${triggerText} text-secondary truncate leading-tight`}>
            {name}
          </p>
        </div>
        {courses.length > 1 ? (
          <ChevronDown
            className={`w-3.5 h-3.5 text-primary shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden
          />
        ) : null}
      </button>

      {open && courses.length > 1 ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute z-50 mt-1.5 left-0 right-0 min-w-[220px] overflow-hidden rounded-xl border-2 border-primary/25 bg-white shadow-lg shadow-sky-900/10 py-1"
        >
          {courses.map((course) => {
            const selected = course.id === (active?.id ?? '')
            return (
              <li key={course.id} role="option" aria-selected={selected}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => {
                    setOpen(false)
                    if (!selected) onSelect(course.id)
                  }}
                  className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors ${
                    selected
                      ? 'bg-primary text-white'
                      : 'text-secondary hover:bg-sky-50'
                  }`}
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                      selected ? 'bg-white/20' : 'bg-sky-100 text-primary'
                    }`}
                  >
                    <GraduationCap className="h-4 w-4" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 font-semibold text-sm truncate">
                    {course.name}
                  </span>
                  {selected ? (
                    <Check className="h-4 w-4 shrink-0 text-white" aria-hidden />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
