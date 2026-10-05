'use client'

import { useState, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  HelpCircle,
  BookOpen,
  ClipboardList,
  Award,
  Settings,
  Menu,
  X,
  LogOut,
  MessageSquare,
  Dumbbell,
  GraduationCap,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'
import Button from '@/components/ui/Button'
import PlatformLogo from '@/components/ui/PlatformLogo'
import AdminCourseSwitcher from '@/components/courses/AdminCourseSwitcher'
import { AdminCourseProvider, useAdminCourse } from '@/components/courses/AdminCourseProvider'
import { useSessionGuard } from '@/hooks/useSessionGuard'

type NavItem = {
  name: string
  href: string
  icon: LucideIcon
  /** Se true, só aparece quando o curso ativo tem exercícios. */
  requiresExercises?: boolean
}

type NavSection = {
  id: 'course' | 'system'
  label: string
  items: NavItem[]
}

const COURSE_NAV: NavItem[] = [
  { name: 'Painel', href: '/admin/dashboard', icon: LayoutDashboard },
  { name: 'Alunos', href: '/admin/alunos', icon: Users },
  { name: 'Perguntas', href: '/admin/perguntas', icon: HelpCircle },
  { name: 'Temas', href: '/admin/temas', icon: BookOpen },
  { name: 'Avaliações', href: '/admin/avaliacoes', icon: ClipboardList },
  { name: 'Parâmetros', href: '/admin/parametros', icon: SlidersHorizontal },
  { name: 'Exercícios', href: '/admin/exercicios', icon: Dumbbell, requiresExercises: true },
]

const SYSTEM_NAV: NavItem[] = [
  { name: 'Cursos', href: '/admin/cursos', icon: GraduationCap },
  { name: 'Certificados', href: '/admin/certificados', icon: Award },
  { name: 'Feedbacks', href: '/admin/feedback', icon: MessageSquare },
  { name: 'Configurações', href: '/admin/configuracoes', icon: Settings },
]

function filterNav(items: NavItem[], courseLoading: boolean, hasExercises: boolean) {
  return items.filter((item) => {
    if (!item.requiresExercises) return true
    if (courseLoading) return false
    return hasExercises
  })
}

function NavLinkList({
  items,
  pathname,
  onNavigate,
  dense,
}: {
  items: NavItem[]
  pathname: string
  onNavigate?: () => void
  dense?: boolean
}) {
  return (
    <div className="space-y-1">
      {items.map((item) => {
        const isActive = pathname.startsWith(item.href)
        return (
          <Link
            key={item.name}
            href={item.href}
            onClick={onNavigate}
            className={`group flex items-center px-2 py-2 font-medium rounded-md transition-colors ${
              dense ? 'text-sm' : 'text-base'
            } ${
              isActive
                ? 'bg-primary text-white'
                : 'text-slate-200 hover:bg-secondary-light hover:text-white'
            }`}
          >
            <item.icon
              className={`flex-shrink-0 ${dense ? 'mr-3 h-5 w-5' : 'mr-4 h-6 w-6'}`}
            />
            {item.name}
          </Link>
        )
      })}
    </div>
  )
}

function SidebarNav({
  sections,
  pathname,
  onNavigate,
  dense,
}: {
  sections: NavSection[]
  pathname: string
  onNavigate?: () => void
  dense?: boolean
}) {
  return (
    <nav className="mt-2 flex-1 px-2 space-y-5" aria-label="Menu administrativo">
      {sections.map((section) =>
        section.items.length === 0 ? null : (
          <div key={section.id}>
            <p className="px-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-sky-200/80">
              {section.label}
            </p>
            <NavLinkList
              items={section.items}
              pathname={pathname}
              onNavigate={onNavigate}
              dense={dense}
            />
          </div>
        )
      )}
    </nav>
  )
}

function AdminShell({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const { profile } = useSessionGuard(20000)
  const pathname = usePathname()
  const router = useRouter()
  const { hasExercises, loading: courseLoading, activeCourse } = useAdminCourse()

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    router.push('/login')
  }, [router])

  const sections = useMemo<NavSection[]>(() => {
    const courseItems = filterNav(COURSE_NAV, courseLoading, hasExercises)
    return [
      {
        id: 'course',
        label: activeCourse?.name
          ? `Curso · ${activeCourse.name}`
          : 'Curso ativo',
        items: courseItems,
      },
      {
        id: 'system',
        label: 'Sistema',
        items: SYSTEM_NAV,
      },
    ]
  }, [courseLoading, hasExercises, activeCourse?.name])

  const allItems = useMemo(
    () => sections.flatMap((s) => s.items),
    [sections]
  )

  const getPageTitle = () => {
    const item = allItems.find((i) => pathname.startsWith(i.href) && i.href !== '/admin')
    if (item) return item.name
    if (pathname.startsWith('/admin/exercicios')) return 'Exercícios'
    return 'Administração'
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 bg-secondary">
        <div className="flex-1 flex flex-col min-h-0 pt-5 pb-4 overflow-y-auto">
          <div className="flex-shrink-0 px-4 mb-4">
            <div className="flex items-center">
              <PlatformLogo width={40} height={40} className="rounded-full" />
              <span className="ml-3 text-white font-bold text-lg truncate">Painel Admin</span>
            </div>
            {activeCourse?.name ? (
              <div className="mt-3 rounded-lg bg-primary/90 px-3 py-2 border border-white/15">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100">
                  Curso ativo
                </p>
                <p className="text-sm font-bold text-white truncate leading-snug">
                  {activeCourse.name}
                </p>
              </div>
            ) : null}
          </div>
          <SidebarNav sections={sections} pathname={pathname} dense />
        </div>
      </div>

      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 md:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-gray-600 bg-opacity-75"
            onClick={() => setIsSidebarOpen(false)}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-secondary min-h-screen">
            <div className="absolute top-0 right-0 -mr-12 pt-2">
              <button
                type="button"
                className="ml-1 flex items-center justify-center h-10 w-10 rounded-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white"
                onClick={() => setIsSidebarOpen(false)}
              >
                <span className="sr-only">Fechar sidebar</span>
                <X className="h-6 w-6 text-white" />
              </button>
            </div>
            <div className="flex-1 h-0 pt-5 pb-4 overflow-y-auto">
              <div className="flex-shrink-0 px-4 mb-4">
                <div className="flex items-center">
                  <PlatformLogo width={40} height={40} className="rounded-full" />
                  <span className="ml-3 text-white font-bold text-lg truncate">Painel Admin</span>
                </div>
                {activeCourse?.name ? (
                  <div className="mt-3 rounded-lg bg-primary/90 px-3 py-2 border border-white/15">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-100">
                      Curso ativo
                    </p>
                    <p className="text-sm font-bold text-white truncate leading-snug">
                      {activeCourse.name}
                    </p>
                  </div>
                ) : null}
              </div>
              <SidebarNav
                sections={sections}
                pathname={pathname}
                onNavigate={() => setIsSidebarOpen(false)}
              />
            </div>
          </div>
        </div>
      )}

      <div className="md:pl-64 flex flex-col flex-1 w-full">
        <div className="sticky top-0 z-10 flex-shrink-0 flex min-h-16 bg-white shadow-sm border-b border-gray-200">
          <button
            type="button"
            className="px-4 border-r border-gray-200 text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary md:hidden hover:bg-gray-50"
            onClick={() => setIsSidebarOpen(true)}
          >
            <span className="sr-only">Abrir sidebar</span>
            <Menu className="h-6 w-6" />
          </button>

          <div className="flex-1 px-3 sm:px-4 py-2 flex justify-between items-center gap-2 sm:gap-4">
            <h1 className="text-lg sm:text-xl font-semibold text-gray-800 shrink-0">
              {getPageTitle()}
            </h1>

            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <AdminCourseSwitcher />
              <span className="hidden lg:block text-sm font-medium text-gray-700 shrink-0">
                {profile?.full_name}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-500 hover:text-primary shrink-0"
              >
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:block">Sair</span>
              </Button>
            </div>
          </div>
        </div>

        <main className="flex-1 w-full relative overflow-y-auto focus:outline-none">
          <div className="py-6">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">{children}</div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminCourseProvider>
      <AdminShell>{children}</AdminShell>
    </AdminCourseProvider>
  )
}
