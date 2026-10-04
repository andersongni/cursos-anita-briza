'use client'

import { useState, useCallback } from 'react'
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
} from 'lucide-react'
import Button from '@/components/ui/Button'
import PlatformLogo from '@/components/ui/PlatformLogo'
import FontSizeControl from '@/components/accessibility/FontSizeControl'
import { useSessionGuard } from '@/hooks/useSessionGuard'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const { profile } = useSessionGuard(10000)
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // ignore
    }
    router.push('/login')
  }, [router])

  const navItems = [
    { name: 'Início', href: '/dashboard', icon: Home },
    { name: 'Exercícios', href: '/student/exercicios', icon: Dumbbell },
    { name: 'Simulado', href: '/student/simulado', icon: PlayCircle },
    { name: 'Prova', href: '/student/prova', icon: FileText },
    { name: 'Histórico', href: '/student/historico', icon: History },
    { name: 'Certificados', href: '/student/certificados', icon: Award },
    { name: 'Feedback', href: '/student/feedback', icon: MessageSquare },
  ]

  const isActive = (href: string) =>
    pathname === href || (href !== '/dashboard' && pathname.startsWith(href))

  // Modo foco: execução da prova/simulado
  const isAssessmentFocus = /^\/student\/avaliacao\/[^/]+\/?$/.test(pathname)

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
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-20">
        {/* Linha 1: marca + acessibilidade + conta */}
        <div className="border-b border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex h-14 sm:h-16 items-center justify-between gap-3">
              <Link href="/dashboard" className="flex items-center gap-2.5 min-w-0 shrink">
                <PlatformLogo width={40} height={40} className="rounded-full shrink-0" />
                <span className="font-bold text-secondary text-base sm:text-lg truncate">
                  Plataforma de Avaliação
                </span>
              </Link>

              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <div className="hidden sm:flex items-center gap-2 rounded-lg bg-slate-50 border border-slate-200 px-2 py-1">
                  <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Texto</span>
                  <FontSizeControl compact />
                </div>
                <div className="sm:hidden">
                  <FontSizeControl compact />
                </div>

                <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200">
                  <span className="text-sm text-gray-700 max-w-[10rem] lg:max-w-[14rem] truncate">
                    {profile?.full_name}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleLogout}
                    className="text-gray-500 hover:text-primary"
                  >
                    <LogOut className="w-4 h-4 mr-1.5" />
                    Sair
                  </Button>
                </div>

                <button
                  type="button"
                  className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                  onClick={() => setIsMobileMenuOpen((open) => !open)}
                  aria-expanded={isMobileMenuOpen}
                  aria-controls="student-mobile-menu"
                >
                  <span className="sr-only">Abrir menu</span>
                  {isMobileMenuOpen ? (
                    <X className="block h-6 w-6" />
                  ) : (
                    <Menu className="block h-6 w-6" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Linha 2: navegação (só desktop/tablet largo) — sem disputa com acessibilidade */}
        <nav className="hidden md:block" aria-label="Menu do aluno">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <ul className="flex flex-wrap gap-x-1 gap-y-0">
              {navItems.map((item) => {
                const active = isActive(item.href)
                return (
                  <li key={item.name}>
                    <Link
                      href={item.href}
                      className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                        active
                          ? 'border-primary text-secondary'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      <item.icon className="w-4 h-4 opacity-70" aria-hidden />
                      {item.name}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </div>
        </nav>

        {/* Menu colapsável (mobile / tablet) */}
        {isMobileMenuOpen && (
          <div
            id="student-mobile-menu"
            className="md:hidden border-t border-gray-200 bg-white"
          >
            <div className="pt-2 pb-2 space-y-0.5">
              {navItems.map((item) => {
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

      <main className="flex-1 w-full">{children}</main>

      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>Núcleo Assistencial Anita Briza — O Futuro Depende de Nós</p>
          <p className="mt-1">&copy; {new Date().getFullYear()} Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
