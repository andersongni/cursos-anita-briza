'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Menu,
  X,
  LogOut,
  Home,
  PlayCircle,
  FileText,
  History,
  Award,
  MessageSquare,
  Dumbbell,
  GraduationCap,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import PlatformLogo from '@/components/ui/PlatformLogo'
import FontSizeControl from '@/components/accessibility/FontSizeControl'
import StudentCourseSwitcher from '@/components/courses/StudentCourseSwitcher'
import { useSessionGuard } from '@/hooks/useSessionGuard'
export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [showExercises, setShowExercises] = useState(false)
  const [hasActiveEnrollment, setHasActiveEnrollment] = useState(false)
  const { profile } = useSessionGuard(10000)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/student/courses', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        const active = data.active ?? data.courses ?? []
        setHasActiveEnrollment(Array.isArray(active) && active.length > 0)
        setShowExercises(Boolean(data.activeCourseHasExercises))
      } catch {
        // ignore
      }
    }
    void load()
  }, [pathname])

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    router.push('/login')
  }, [router])

  const accountNav = useMemo(
    () => [
      { name: 'Início', href: '/dashboard', icon: Home },
      { name: 'Matrículas', href: '/student/matriculas', icon: GraduationCap },
      { name: 'Certificados', href: '/student/certificados', icon: Award },
      { name: 'Feedback', href: '/student/feedback', icon: MessageSquare },
    ],
    []
  )

  const courseNav = useMemo(
    () =>
      hasActiveEnrollment
        ? [
            ...(showExercises
              ? [{ name: 'Exercícios', href: '/student/exercicios', icon: Dumbbell }]
              : []),
            { name: 'Simulado', href: '/student/simulado', icon: PlayCircle },
            { name: 'Prova', href: '/student/prova', icon: FileText },
            { name: 'Histórico', href: '/student/historico', icon: History },
          ]
        : [],
    [showExercises, hasActiveEnrollment]
  )

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  // Modo foco: execução da prova/simulado
  const isAssessmentFocus = /^\/student\/avaliacao\/[^/]+\/?$/.test(pathname)
  // Telas de início: cabem na viewport sem scroll (sem rodapé)
  const isAssessmentStart =
    pathname === '/student/simulado' || pathname === '/student/prova'

  if (isAssessmentFocus) {
    return (
      <div className="h-dvh bg-slate-50 flex flex-col overflow-hidden">
        <div className="shrink-0 z-[100] flex items-center justify-between gap-2 px-2 sm:px-3 py-1.5 bg-amber-50 border-b border-amber-300">
          <span className="text-xs sm:text-sm font-semibold text-amber-950">Texto</span>
          <FontSizeControl compact />
        </div>
        <main className="flex-1 min-h-0 w-full overflow-hidden">{children}</main>
      </div>
    )
  }

  return (
    <div
      className={`bg-slate-50 flex flex-col ${
        isAssessmentStart ? 'h-dvh overflow-hidden' : 'min-h-screen'
      }`}
    >
      <header className="bg-white shadow-sm sticky top-0 z-20">
        {/* Linha 1: marca + curso + ações */}
        <div className="border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-11 sm:h-12 items-center justify-between gap-2 sm:gap-3">
              <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                <Link href="/dashboard" className="flex items-center gap-2 min-w-0 shrink">
                  <PlatformLogo width={32} height={32} className="rounded-full shrink-0" />
                  <span className="font-bold text-secondary text-sm truncate max-w-[9rem] sm:max-w-none">
                    Plataforma de Estudos
                  </span>
                </Link>
                <div className="hidden md:block min-w-0 max-w-[220px] lg:max-w-[280px] border-l border-slate-200 pl-2.5">
                  <StudentCourseSwitcher variant="bar" />
                </div>
              </div>

              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="hidden sm:flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-1.5 py-0.5">
                  <span className="text-[11px] font-medium text-slate-500 whitespace-nowrap">
                    Texto
                  </span>
                  <FontSizeControl compact />
                </div>
                <div className="sm:hidden">
                  <FontSizeControl compact />
                </div>

                <div className="hidden md:flex items-center gap-1.5 pl-2 border-l border-slate-200">
                  <span className="text-xs text-gray-700 max-w-[8rem] lg:max-w-[12rem] truncate">
                    {profile?.full_name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-primary h-8 px-2"
                  >
                    <LogOut className="w-3.5 h-3.5 sm:mr-1" />
                    <span className="hidden sm:inline text-xs">Sair</span>
                  </Button>
                </div>

                <button
                  type="button"
                  className="md:hidden inline-flex items-center justify-center p-1.5 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsMobileMenuOpen((open) => !open)}
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="student-mobile-menu"
                >
                  <span className="sr-only">Abrir menu</span>
                  {isMobileMenuOpen ? (
                    <X className="block h-5 w-5" />
                  ) : (
                    <Menu className="block h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Curso no mobile (desktop já está na linha 1) */}
        <div className="md:hidden border-b border-primary/20 bg-sky-50/80">
          <div className="max-w-7xl mx-auto px-4 py-1.5">
            <StudentCourseSwitcher variant="bar" />
          </div>
        </div>

        {/* Navegação: conta (linha 1) + curso (linha 2) */}
        <nav className="hidden md:block" aria-label="Menu do aluno">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ul className="flex flex-wrap gap-x-0.5 gap-y-0 border-b border-slate-100">
              {accountNav.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-medium border-b-2 -mb-px transition-colors ${
                        active
                          ? 'border-primary text-secondary'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <item.icon className="w-3.5 h-3.5 opacity-70" aria-hidden />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
            {courseNav.length > 0 ? (
              <ul className="flex flex-wrap gap-x-0.5 gap-y-0">
                {courseNav.map((item) => {
                  const active = isActive(item.href)
                  return (
                    <li key={item.name}>
                      <Link
                        href={item.href}
                        className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-medium border-b-2 transition-colors ${
                          active
                            ? 'border-primary text-secondary'
                            : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                        }`}
                      >
                        <item.icon className="w-3.5 h-3.5 opacity-70" aria-hidden />
                        {item.name}
                      </Link>
                    </li>
                  )
                })}
              </ul>
            ) : null}
          </div>
        </nav>

        {/* Menu colapsável (mobile / tablet) */}
        {isMobileMenuOpen && (
          <div
            id="student-mobile-menu"
            className="md:hidden border-t border-gray-200 bg-white"
          >
            <div className="pt-2 pb-2 space-y-1">
              {accountNav.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`flex items-center gap-3 pl-4 pr-4 py-3 border-l-4 text-base font-medium ${
                      active
                        ? 'bg-sky-50 border-primary text-primary'
                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <item.icon className="w-5 h-5 text-gray-400 shrink-0" />
                    {item.name}
                  </Link>
                )
              })}
              {courseNav.length > 0 ? (
                <div className="border-t border-slate-100 mt-1 pt-1">
                  {courseNav.map((item) => {
                    const active = isActive(item.href)
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`flex items-center gap-3 pl-4 pr-4 py-3 border-l-4 text-base font-medium ${
                          active
                            ? 'bg-sky-50 border-primary text-primary'
                            : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                        }`}
                        onClick={() => setIsMobileMenuOpen(false)}
                      >
                        <item.icon className="w-5 h-5 text-gray-400 shrink-0" />
                        {item.name}
                      </Link>
                    )
                  })}
                </div>
              ) : null}
            </div>
            <div className="pt-3 pb-4 border-t border-gray-200 px-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2">
                <span className="text-sm font-medium text-slate-600">Tamanho do texto</span>
                <FontSizeControl compact />
              </div>
              <div className="text-base font-medium text-gray-800">{profile?.full_name}</div>
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-base font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              >
                <LogOut className="w-5 h-5" />
                Sair
              </button>
            </div>
          </div>
        )}
      </header>

      <main
        className={`flex-1 w-full ${isAssessmentStart ? 'min-h-0 overflow-y-auto' : ''}`}
      >
        {children}
      </main>

      {!isAssessmentStart && (
        <footer className="bg-white border-t border-gray-200 py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
            <p>Núcleo Assistencial Anita Briza — O Futuro Depende de Nós</p>
            <p className="mt-1">&copy; {new Date().getFullYear()} Todos os direitos reservados.</p>
          </div>
        </footer>
      )}
    </div>
  )
}
