'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Menu, X, LogOut, Home, PlayCircle, FileText, History, Award } from 'lucide-react'
import Button from '@/components/ui/Button'
import PlatformLogo from '@/components/ui/PlatformLogo'
import FontSizeControl from '@/components/accessibility/FontSizeControl'

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const [profile, setProfile] = useState<any>(null)
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/auth/me')
        if (res.ok) {
          setProfile(await res.json())
        }
      } catch {
        // ignore
      }
    }
    fetchProfile()
  }, [])

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
    { name: 'Simulado', href: '/student/simulado', icon: PlayCircle },
    { name: 'Prova', href: '/student/prova', icon: FileText },
    { name: 'Histórico', href: '/student/historico', icon: History },
    { name: 'Certificados', href: '/student/certificados', icon: Award },
  ]

  // Modo foco: execução da prova/simulado (sem /resumo)
  const isAssessmentFocus = /^\/student\/avaliacao\/[^/]+$/.test(pathname)

  if (isAssessmentFocus) {
    return (
      <div className="h-dvh bg-slate-50 flex flex-col overflow-hidden">
        <main className="flex-1 min-h-0 w-full overflow-hidden">{children}</main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Top Navigation Bar */}
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <Link href="/dashboard" className="flex items-center gap-3">
                  <PlatformLogo width={40} height={40} className="rounded-full" />
                  <span className="font-bold text-secondary text-lg hidden sm:block">
                    Plataforma de Avaliação
                  </span>
                </Link>
              </div>
              <nav className="hidden sm:ml-8 sm:flex sm:space-x-8">
                {navItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium ${
                        isActive
                          ? 'border-primary text-secondary'
                          : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                      }`}
                    >
                      {item.name}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="hidden sm:ml-6 sm:flex sm:items-center gap-3">
              <FontSizeControl />
              <span className="text-sm text-gray-700">
                {profile?.full_name}
              </span>
              <Button variant="ghost" size="sm" onClick={handleLogout} className="text-gray-500 hover:text-primary">
                <LogOut className="w-4 h-4 mr-2" />
                Sair
              </Button>
            </div>

            <div className="flex items-center gap-1 sm:hidden">
              <FontSizeControl compact />
              <button
                type="button"
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100"
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              >
                <span className="sr-only">Abrir menu</span>
                {isMobileMenuOpen ? <X className="block h-6 w-6" /> : <Menu className="block h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200">
            <div className="pt-2 pb-3 space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium ${
                      isActive
                        ? 'bg-red-50 border-primary text-primary'
                        : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                    }`}
                    onClick={() => setIsMobileMenuOpen(false)}
                  >
                    <div className="flex items-center">
                      <item.icon className="w-5 h-5 mr-3 text-gray-400" />
                      {item.name}
                    </div>
                  </Link>
                )
              })}
            </div>
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center px-4">
                <div className="ml-3">
                  <div className="text-base font-medium text-gray-800">{profile?.full_name}</div>
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <button
                  onClick={handleLogout}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-gray-500 hover:text-gray-800 hover:bg-gray-100"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm text-gray-500">
          <p>Núcleo Assistencial Anita Briza — O Futuro Depende de Nós</p>
          <p className="mt-1">&copy; {new Date().getFullYear()} Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  )
}
